import "server-only";
import { prisma } from "@/lib/prisma";
import type { OsActor } from "@/lib/os/permissions";
import { sessionScope, registrationScope, athleteScope } from "@/lib/os/dal";
import { facilityToday } from "@/lib/facility-time";
import { FOUNDING_OFFER } from "@/lib/founding-offer";

// ---------------------------------------------------------------------------
// Payments overview for Courts OS: one page answering "who owes us, whose
// card failed, who renews soon, what came in". Everything here is read from
// the same rows the parent app and the Stripe webhook write — this module
// never computes a balance of its own.
// ---------------------------------------------------------------------------

const primaryGuardian = {
  family: {
    select: {
      name: true,
      guardians: {
        orderBy: { isPrimary: "desc" as const },
        take: 1,
        select: { guardian: { select: { id: true, name: true, email: true, phone: true, stripeCustomerId: true, legacyRateCents: true } } },
      },
    },
  },
};

export type PayerInfo = {
  familyName: string;
  guardianName: string | null;
  email: string | null;
  phone: string | null;
  stripeCustomerId: string | null;
};

function payer(a: { family: { name: string; guardians: { guardian: { name: string; email: string | null; phone: string | null; stripeCustomerId: string | null } }[] } }): PayerInfo {
  const g = a.family.guardians[0]?.guardian;
  return {
    familyName: a.family.name,
    guardianName: g?.name ?? null,
    email: g?.email ?? null,
    phone: g?.phone ?? null,
    stripeCustomerId: g?.stripeCustomerId ?? null,
  };
}

const athleteName = (a: { firstName: string; nickname: string | null; lastName: string }) =>
  `${a.nickname?.trim() || a.firstName} ${a.lastName}`;

export async function loadPaymentsOverview(actor: OsActor) {
  const today = facilityToday();
  const in7 = new Date(today.getTime() + 7 * 86_400_000);
  const ago30 = new Date(Date.now() - 30 * 86_400_000);

  const [owedBookings, owedRegistrations, pastDue, renewals, paidBookings, paidRegistrations] = await Promise.all([
    // A seat that still has money outstanding: booked at the desk with no plan
    // covering it ("due"), or a card that was declined ("failed").
    prisma.booking.findMany({
      where: {
        status: { not: "cancelled" },
        paymentStatus: { in: ["due", "failed"] },
        priceChargedCents: { gt: 0 },
        session: sessionScope(actor),
      },
      orderBy: { session: { startTime: "asc" } },
      select: {
        id: true, paymentStatus: true, priceChargedCents: true,
        session: { select: { startTime: true, title: true, offering: { select: { name: true } }, program: { select: { name: true } } } },
        athlete: { select: { id: true, firstName: true, nickname: true, lastName: true, ...primaryGuardian } },
      },
    }),
    prisma.registration.findMany({
      where: { AND: [registrationScope(actor), { status: { not: "cancelled" } }, { paymentStatus: { in: ["due", "failed"] } }] },
      orderBy: { registeredAt: "asc" },
      select: {
        id: true, paymentStatus: true, amountCents: true, registeredAt: true,
        offering: { select: { id: true, name: true } },
        athlete: { select: { id: true, firstName: true, nickname: true, lastName: true, ...primaryGuardian } },
      },
    }),
    prisma.athleteMembership.findMany({
      where: { status: "past_due", athlete: athleteScope(actor) },
      orderBy: { renewalDate: "asc" },
      select: {
        id: true, renewalDate: true, stripeSubscriptionId: true, startDate: true,
        plan: { select: { name: true, priceCents: true } },
        athlete: { select: { id: true, firstName: true, nickname: true, lastName: true, ...primaryGuardian } },
      },
    }),
    prisma.athleteMembership.findMany({
      where: { status: "active", renewalDate: { gte: today, lt: in7 }, athlete: athleteScope(actor) },
      orderBy: { renewalDate: "asc" },
      select: {
        id: true, renewalDate: true, stripeSubscriptionId: true, startDate: true,
        plan: { select: { name: true, priceCents: true } },
        athlete: { select: { id: true, firstName: true, nickname: true, lastName: true, ...primaryGuardian } },
      },
    }),
    prisma.booking.findMany({
      where: { paymentStatus: "paid", priceChargedCents: { gt: 0 }, bookedAt: { gte: ago30 }, session: sessionScope(actor) },
      orderBy: { bookedAt: "desc" },
      take: 50,
      select: {
        id: true, priceChargedCents: true, bookedAt: true, receiptUrl: true,
        session: { select: { startTime: true, title: true, offering: { select: { name: true } }, program: { select: { name: true } } } },
        athlete: { select: { id: true, firstName: true, nickname: true, lastName: true } },
      },
    }),
    prisma.registration.findMany({
      where: { AND: [registrationScope(actor), { paymentStatus: "paid" }, { registeredAt: { gte: ago30 } }] },
      orderBy: { registeredAt: "desc" },
      take: 50,
      select: {
        id: true, amountCents: true, registeredAt: true, receiptUrl: true,
        offering: { select: { name: true } },
        athlete: { select: { id: true, firstName: true, nickname: true, lastName: true } },
      },
    }),
  ]);

  const owed = [
    ...owedBookings.map((b) => ({
      kind: "booking" as const,
      id: b.id,
      athleteId: b.athlete.id,
      athlete: athleteName(b.athlete),
      what: b.session.title ?? b.session.offering?.name ?? b.session.program.name,
      when: b.session.startTime,
      amountCents: b.priceChargedCents ?? 0,
      status: b.paymentStatus,
      payer: payer(b.athlete),
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
      payer: payer(r.athlete),
    })),
  ];

  const membershipRow = (m: (typeof pastDue)[number]) => ({
    id: m.id,
    athleteId: m.athlete.id,
    athlete: athleteName(m.athlete),
    plan: m.plan.name,
    // What this family actually pays — the same rule as the Members page:
    // NextGen legacy families pay their own approved rate, opening-day
    // founders the founding rate, everyone else the plan price.
    priceCents:
      m.plan.name === "NextGen Legacy Rate"
        ? (m.athlete.family.guardians[0]?.guardian.legacyRateCents ?? 0)
        : m.plan.name === FOUNDING_OFFER.planName && m.startDate.toISOString().slice(0, 10) === FOUNDING_OFFER.opensAt.toISOString().slice(0, 10)
          ? FOUNDING_OFFER.rateCents
          : m.plan.priceCents,
    renewalDate: m.renewalDate,
    hasStripe: !!m.stripeSubscriptionId,
    payer: payer(m.athlete),
  });

  const recent = [
    ...paidBookings.map((b) => ({
      key: `b-${b.id}`,
      athlete: athleteName(b.athlete),
      what: b.session.title ?? b.session.offering?.name ?? b.session.program.name,
      on: b.bookedAt,
      amountCents: b.priceChargedCents ?? 0,
      receiptUrl: b.receiptUrl,
    })),
    ...paidRegistrations.map((r) => ({
      key: `r-${r.id}`,
      athlete: athleteName(r.athlete),
      what: r.offering.name,
      on: r.registeredAt,
      amountCents: r.amountCents ?? 0,
      receiptUrl: r.receiptUrl,
    })),
  ].sort((a, b) => b.on.getTime() - a.on.getTime());

  return {
    owed,
    owedTotalCents: owed.reduce((n, o) => n + o.amountCents, 0),
    pastDue: pastDue.map(membershipRow),
    renewals: renewals.map(membershipRow),
    recent,
    recentTotalCents: recent.reduce((n, r) => n + r.amountCents, 0),
  };
}

export type PaymentsOverview = Awaited<ReturnType<typeof loadPaymentsOverview>>;
