import "server-only";
import { prisma } from "@/lib/prisma";
import type { OsActor } from "@/lib/os/permissions";
import { athleteScope, sessionScope, registrationScope } from "@/lib/os/dal";
import { facilityNow } from "@/lib/facility-time";
import { FOUNDING_OFFER } from "@/lib/founding-offer";
import { getUnsignedRequiredWaivers } from "@/lib/waivers";

// ---------------------------------------------------------------------------
// One household, everything staff ask about it: who the adults are, which
// kids, what they're on and pay, what's owed, what's coming up, what's
// happened, and which waivers are still open. One query per concern (all in
// parallel), never one per row — except waivers, which reuse
// getUnsignedRequiredWaivers across the family's small guardian × athlete set
// so the "signed" rule has exactly one definition.
//
// The caller has already run assertFamilyAccess. Athlete-, session- and
// registration-level scopes are still applied here so a sport-scoped head
// coach sees only the parts of the family that touch their sport.
// ---------------------------------------------------------------------------

const OPENING_DAY = FOUNDING_OFFER.opensAt.toISOString().slice(0, 10); // 2026-10-01

const athleteName = (a: { firstName: string; nickname: string | null; lastName: string }) =>
  `${a.nickname?.trim() || a.firstName} ${a.lastName}`;

const sessionSelect = {
  startTime: true,
  endTime: true,
  title: true,
  offering: { select: { name: true } },
  program: { select: { name: true } },
} as const;

const className = (s: { title: string | null; offering: { name: string } | null; program: { name: string } }) =>
  s.title ?? s.offering?.name ?? s.program.name;

export async function loadFamilyDetail(actor: OsActor, familyId: string) {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      guardians: {
        orderBy: { isPrimary: "desc" },
        select: {
          guardianId: true,
          isPrimary: true,
          relationship: true,
          authorizedForPickup: true,
          guardian: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              authId: true,
              stripeCustomerId: true,
              nextGenStatus: true,
              legacyRateCents: true,
            },
          },
        },
      },
    },
  });
  if (!family) return null;

  const wallNow = facilityNow();
  const inFamily = { AND: [{ familyId }, athleteScope(actor)] };

  const [athletes, memberships, owedBookings, owedRegistrations, upcoming, upcomingCount, recent] = await Promise.all([
    prisma.athlete.findMany({
      where: inFamily,
      orderBy: [{ dob: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        nickname: true,
        grade: true,
        dob: true,
        hasMedicalInfo: true,
        hasCustodyRestrictions: true,
        archivedAt: true,
        mediaConsent: { select: { status: true } },
      },
    }),
    prisma.athleteMembership.findMany({
      where: { status: { not: "cancelled" }, athlete: inFamily },
      orderBy: [{ renewalDate: "asc" }, { startDate: "asc" }],
      select: {
        id: true,
        status: true,
        startDate: true,
        renewalDate: true,
        cancelAt: true,
        stripeSubscriptionId: true,
        plan: { select: { name: true, priceCents: true } },
        athlete: { select: { id: true, firstName: true, nickname: true, lastName: true } },
      },
    }),
    prisma.booking.findMany({
      where: {
        status: { not: "cancelled" },
        paymentStatus: { in: ["due", "failed"] },
        priceChargedCents: { gt: 0 },
        athlete: inFamily,
        session: sessionScope(actor),
      },
      orderBy: { session: { startTime: "asc" } },
      select: {
        id: true,
        paymentStatus: true,
        priceChargedCents: true,
        session: { select: sessionSelect },
        athlete: { select: { id: true, firstName: true, nickname: true, lastName: true } },
      },
    }),
    prisma.registration.findMany({
      where: {
        AND: [
          registrationScope(actor),
          { athlete: inFamily },
          { status: { not: "cancelled" } },
          { paymentStatus: { in: ["due", "failed"] } },
        ],
      },
      orderBy: { registeredAt: "asc" },
      select: {
        id: true,
        paymentStatus: true,
        amountCents: true,
        registeredAt: true,
        offering: { select: { name: true } },
        athlete: { select: { id: true, firstName: true, nickname: true, lastName: true } },
      },
    }),
    prisma.booking.findMany({
      where: {
        status: { not: "cancelled" },
        athlete: inFamily,
        session: { AND: [sessionScope(actor), { status: { not: "cancelled" } }, { startTime: { gte: wallNow } }] },
      },
      orderBy: { session: { startTime: "asc" } },
      take: 10,
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        session: { select: sessionSelect },
        athlete: { select: { id: true, firstName: true, nickname: true, lastName: true } },
      },
    }),
    prisma.booking.count({
      where: {
        status: { not: "cancelled" },
        athlete: inFamily,
        session: { AND: [sessionScope(actor), { status: { not: "cancelled" } }, { startTime: { gte: wallNow } }] },
      },
    }),
    prisma.booking.findMany({
      where: {
        status: { not: "cancelled" },
        athlete: inFamily,
        session: { AND: [sessionScope(actor), { status: { not: "cancelled" } }, { startTime: { lt: wallNow } }] },
      },
      orderBy: { session: { startTime: "desc" } },
      take: 10,
      select: {
        id: true,
        status: true,
        session: { select: sessionSelect },
        athlete: { select: { id: true, firstName: true, nickname: true, lastName: true } },
        attendance: { select: { status: true } },
      },
    }),
  ]);

  // Waivers: an athlete's required waiver counts as signed if ANY guardian in
  // the family cleared it, so "missing" is the intersection of each
  // guardian's unsigned list.
  const activeAthletes = athletes.filter((a) => !a.archivedAt);
  const guardianIds = family.guardians.map((g) => g.guardianId);
  const requiredIfNoGuardians =
    guardianIds.length === 0 && activeAthletes.length > 0
      ? await prisma.waiver.findMany({ where: { required: true }, select: { id: true, waiverType: true } })
      : [];
  const waiverPairs = await Promise.all(
    activeAthletes.map(async (a) => {
      if (guardianIds.length === 0) {
        return [a.id, requiredIfNoGuardians.map((w) => ({ id: w.id, name: w.waiverType }))] as const;
      }
      const perGuardian = await Promise.all(guardianIds.map((gid) => getUnsignedRequiredWaivers(gid, a.id)));
      const [first, ...rest] = perGuardian;
      const missing = first.filter((w) => rest.every((list) => list.some((x) => x.id === w.id)));
      return [a.id, missing.map((w) => ({ id: w.id, name: w.waiverType }))] as const;
    })
  );
  const missingWaivers = new Map<string, { id: string; name: string }[]>(waiverPairs);

  // What each kid actually pays — the Members page rule: NextGen legacy
  // families pay their own approved rate, opening-day founders (not NextGen)
  // the founding rate, everyone else the plan price.
  const primary = family.guardians[0]?.guardian ?? null;
  const isNextGen = primary?.nextGenStatus === "current_nextgen" || primary?.nextGenStatus === "former_nextgen";
  const rateFor = (m: (typeof memberships)[number]) =>
    m.plan.name === "NextGen Legacy Rate"
      ? (primary?.legacyRateCents ?? 0)
      : m.plan.name === FOUNDING_OFFER.planName && !isNextGen && m.startDate.toISOString().slice(0, 10) === OPENING_DAY
        ? FOUNDING_OFFER.rateCents
        : m.plan.priceCents;

  const membershipRows = memberships.map((m) => ({
    id: m.id,
    athleteId: m.athlete.id,
    athlete: athleteName(m.athlete),
    plan: m.plan.name,
    status: m.status,
    rateCents: rateFor(m),
    startDate: m.startDate,
    renewalDate: m.renewalDate,
    cancelAt: m.cancelAt,
    hasStripe: !!m.stripeSubscriptionId,
  }));

  const owed = [
    ...owedBookings.map((b) => ({
      kind: "booking" as const,
      id: b.id,
      athleteId: b.athlete.id,
      athlete: athleteName(b.athlete),
      what: className(b.session),
      when: b.session.startTime,
      amountCents: b.priceChargedCents ?? 0,
      status: b.paymentStatus,
    })),
    ...owedRegistrations.map((r) => ({
      kind: "registration" as const,
      id: r.id,
      athleteId: r.athlete.id,
      athlete: athleteName(r.athlete),
      what: r.offering.name,
      when: r.registeredAt,
      amountCents: r.amountCents ?? 0,
      status: r.paymentStatus,
    })),
  ];

  // "Member since": the earliest membership start (a calendar date), else
  // when the family record was created (a real timestamp).
  const earliestStart = memberships.reduce<Date | null>(
    (min, m) => (!min || m.startDate < min ? m.startDate : min),
    null
  );

  return {
    family: { id: family.id, name: family.name, createdAt: family.createdAt },
    guardians: family.guardians,
    athletes,
    memberships: membershipRows,
    monthlyCents: membershipRows.filter((m) => m.status === "active").reduce((n, m) => n + m.rateCents, 0),
    owed,
    owedTotalCents: owed.reduce((n, o) => n + o.amountCents, 0),
    upcoming: upcoming.map((b) => ({
      id: b.id,
      athleteId: b.athlete.id,
      athlete: athleteName(b.athlete),
      what: className(b.session),
      start: b.session.startTime,
      end: b.session.endTime,
      status: b.status,
      paymentStatus: b.paymentStatus,
    })),
    upcomingCount,
    recent: recent.map((b) => ({
      id: b.id,
      athleteId: b.athlete.id,
      athlete: athleteName(b.athlete),
      what: className(b.session),
      start: b.session.startTime,
      end: b.session.endTime,
      bookingStatus: b.status,
      attendance: b.attendance?.status ?? null,
    })),
    missingWaivers,
    memberSince: earliestStart
      ? { date: earliestStart, isCalendarDate: true }
      : { date: family.createdAt, isCalendarDate: false },
  };
}

export type FamilyDetail = NonNullable<Awaited<ReturnType<typeof loadFamilyDetail>>>;
