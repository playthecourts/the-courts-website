import "server-only";
import { prisma } from "@/lib/prisma";
import { availabilityFor, type Availability, qualifiesForAvailableThisWeek } from "./availability";
import { checkAgeAndGrade, type AthleteForEligibility } from "./eligibility";
import { resolveBookingRule } from "./pricing";
import { describeBookingRule } from "./format";
import { programTypeDef, gradeRangeLabel } from "./types";

// ---------------------------------------------------------------------------
// What the Parent App shows.
//
// The visibility rule is stated once, here, and every parent-facing surface
// reads through it. An offering reaches a family only when it is published,
// flagged for the Parent App, not internal-only, and has a future session.
// There is no second list to curate and no way for a draft to leak.
// ---------------------------------------------------------------------------

export type ParentSessionCard = {
  sessionId: string;
  offeringId: string;
  offeringName: string;
  programType: string;
  programTypeLabel: string;
  sport: string | null;
  shortDescription: string | null;
  gradeLabel: string | null;
  imageUrl: string | null;
  imageAltText: string | null;
  whatToBring: string[];
  parentInstructions: string | null;
  startTime: Date;
  endTime: Date;
  resourceName: string | null;
  coachNames: string[];
  availability: Availability;
  /// Per-athlete: whether this athlete may book, and what it costs them.
  perAthlete: {
    athleteId: string;
    athleteName: string;
    eligible: boolean;
    ineligibleReason: string | null;
    bookingRuleText: string;
    hasSeat: boolean;
    waitlisted: boolean;
    waitlistOffered: boolean;
    waitlistEntryId: string | null;
  }[];
};

/// The single visibility predicate. Everything parent-facing goes through it.
export const PARENT_VISIBLE = {
  status: "published" as const,
  internalOnly: false,
  visibleParentApp: true,
};

export async function loadParentFeed(
  athletes: AthleteForEligibility[] & { firstName: string; lastName: string }[],
  opts: { sport?: string; programType?: string; from?: Date; to?: Date } = {}
): Promise<ParentSessionCard[]> {
  const now = new Date();
  const athleteIds = athletes.map((a) => a.id);

  const sessions = await prisma.session.findMany({
    where: {
      status: "scheduled",
      startTime: { gte: opts.from ?? now, ...(opts.to ? { lt: opts.to } : {}) },
      offering: {
        ...PARENT_VISIBLE,
        ...(opts.sport ? { program: { sport: opts.sport } } : {}),
        ...(opts.programType ? { program: { programType: opts.programType as never } } : {}),
      },
    },
    orderBy: { startTime: "asc" },
    take: 200,
    include: {
      offering: { include: { program: true } },
      resource: { select: { name: true } },
      coaches: { include: { staff: { select: { name: true } } } },
      bookings: {
        where: { athleteId: { in: athleteIds }, status: { not: "cancelled" } },
        select: { athleteId: true },
      },
      waitlistEntries: {
        where: { athleteId: { in: athleteIds }, status: { in: ["waiting", "offered"] } },
        select: { id: true, athleteId: true, status: true },
      },
      _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } },
    },
  });

  const cards: ParentSessionCard[] = [];

  for (const s of sessions) {
    const o = s.offering!;
    const def = programTypeDef(o.program.programType);

    const availability = availabilityFor(
      {
        status: o.status,
        registrationOpensAt: o.registrationOpensAt,
        registrationClosesAt: o.registrationClosesAt,
        closeWhenFull: o.closeWhenFull,
        waitlistMode: o.waitlistMode,
        lowSpotThreshold: o.lowSpotThreshold,
        capacity: s.capacity,
        booked: s._count.bookings,
      },
      now
    );

    const perAthlete = [];
    for (const athlete of athletes) {
      const check = def.defaults.hasEligibility
        ? checkAgeAndGrade(athlete, o, s.startTime)
        : ({ eligible: true } as const);

      const hasSeat = s.bookings.some((b) => b.athleteId === athlete.id);
      const wl = s.waitlistEntries.find((w) => w.athleteId === athlete.id);

      // Only priced for athletes who could actually book it — no point
      // computing a Training Plan rule for a child who isn't eligible.
      const ruleText =
        check.eligible && !hasSeat
          ? describeBookingRule(await resolveBookingRule(athlete.id, o.id, s.startTime))
          : "";

      perAthlete.push({
        athleteId: athlete.id,
        athleteName: athlete.firstName,
        eligible: check.eligible,
        ineligibleReason: check.eligible ? null : check.parentFacing ? check.reason : null,
        bookingRuleText: ruleText,
        hasSeat,
        waitlisted: wl?.status === "waiting",
        waitlistOffered: wl?.status === "offered",
        waitlistEntryId: wl?.id ?? null,
      });
    }

    // A session no athlete in this family can attend is noise on their screen.
    if (!perAthlete.some((p) => p.eligible)) continue;

    cards.push({
      sessionId: s.id,
      offeringId: o.id,
      offeringName: s.title ?? o.name,
      programType: o.program.programType,
      programTypeLabel: def.label,
      sport: o.program.sport,
      shortDescription: o.shortDescription,
      gradeLabel: gradeRangeLabel(o.gradeMin, o.gradeMax),
      imageUrl: o.imageUrl,
      imageAltText: o.imageAltText,
      whatToBring: o.whatToBring,
      parentInstructions: o.parentInstructions,
      startTime: s.startTime,
      endTime: s.endTime,
      resourceName: s.resource?.name ?? null,
      coachNames: s.coaches.map((c) => c.staff.name),
      availability,
      perAthlete,
    });
  }

  return cards;
}

/// "Available This Week" — driven entirely by the scheduler, never curated by
/// hand. A program appears when it is published, eligible, registration is
/// open, a future session exists this week, and there is room or a waitlist.
export async function availableThisWeek(
  athletes: AthleteForEligibility[] & { firstName: string; lastName: string }[]
): Promise<ParentSessionCard[]> {
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 86_400_000);
  const cards = await loadParentFeed(athletes, { from: now, to: weekEnd });
  return cards.filter((c) => qualifiesForAvailableThisWeek(c.availability, true));
}
