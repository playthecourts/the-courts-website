import { facilityNow } from "@/lib/facility-time";
import "server-only";
import { prisma } from "@/lib/prisma";
import { availabilityFor, type Availability, qualifiesForAvailableThisWeek } from "./availability";
import { checkAgeAndGrade, type AthleteForEligibility } from "./eligibility";
import { resolveBookingRule } from "./pricing";
import { describeBookingRule } from "./format";
import { programTypeDef, gradeRangeLabel, parentCategoryFor, typesInCategory } from "./types";

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
  /// Governs the cancellation policy note shown at booking time: only
  /// "session" (drop-in classes, Dr. Dish) can ever refund. Camps
  /// ("offering"/"multi_day") and League ("season") never do, regardless of
  /// timing — see cancelBookingById in lib/booking.ts.
  registrationMode: string;
  programType: string;
  programTypeLabel: string;
  /// Parent-facing bucket, not the admin type.
  category: string;
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
  capacity: number | null;
  booked: number;
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
  opts: {
    sport?: string;
    programType?: string;
    /// A parent-facing bucket (see PARENT_CATEGORIES) rather than one of the 12
    /// admin program types.
    category?: string;
    /// One offering only — for a "Book" deep link from playthecourts.com, which
    /// names a single class. Pushed into the query rather than filtered out of
    /// the results afterwards: this function takes only the first 200 sessions,
    /// so filtering after the fact was both slow (200 sessions' bookings,
    /// waitlists, coaches and a per-athlete pricing lookup each, to render
    /// ~20 of them) and wrong (a class whose sessions all fall past the 200-row
    /// window rendered an empty page).
    offeringId?: string;
    from?: Date;
    to?: Date;
  } = {}
): Promise<ParentSessionCard[]> {
  const now = new Date();
  const athleteIds = athletes.map((a) => a.id);

  const sessions = await prisma.session.findMany({
    where: {
      status: "scheduled",
      startTime: { gte: opts.from ?? facilityNow(), ...(opts.to ? { lt: opts.to } : {}) },
      ...(opts.offeringId ? { offeringId: opts.offeringId } : {}),
      offering: {
        ...PARENT_VISIBLE,
        ...(opts.sport ? { program: { sport: opts.sport } } : {}),
        ...(opts.programType ? { program: { programType: opts.programType as never } } : {}),
        ...(opts.category
          ? { program: { programType: { in: typesInCategory(opts.category) } } }
          : {}),
      },
    },
    orderBy: { startTime: "asc" },
    take: 200,
    include: {
      offering: { include: { program: true } },
      resource: { select: { name: true } },
      coaches: { include: { staff: { select: { name: true } } } },
      // Not filtered to this family's athletes: a "bring a teammate" price
      // needs to know what the FIRST booker on the session paid, and that
      // first booker is very often a different family entirely.
      bookings: {
        where: { status: { not: "cancelled" } },
        select: { athleteId: true, priceChargedCents: true, bookedAt: true },
        orderBy: { bookedAt: "asc" },
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

    // A per-session Book button only ever means "buy this one occurrence" —
    // see the matching hard gate in bookAthleteIntoSession (lib/booking.ts).
    // Camps sold as a package and League register through their own
    // dedicated flows; surfacing a Book button here that then throws on
    // click is a worse experience than the session simply not appearing in
    // this feed.
    if (o.registrationMode !== "session") continue;

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
          ? describeBookingRule(
              await resolveBookingRule(athlete.id, o.id, s.startTime, s.bookings[0]?.priceChargedCents ?? null)
            )
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
      registrationMode: o.registrationMode,
      programType: o.program.programType,
      programTypeLabel: def.label,
      category: parentCategoryFor(o.program.programType),
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
      capacity: s.capacity,
      booked: s._count.bookings,
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

// ---------------------------------------------------------------------------
// The Explore calendar sidebar's own loader.
//
// The sidebar needs five fields per session — session id, offering id + name,
// start time, availability — to answer "which days have something bookable".
// It used to reuse loadParentFeed(), which for every one of 200 sessions also
// fetches each booking row, each waitlist entry, coaches and resource, and
// then resolves a per-athlete booking rule with an awaited DB call per athlete
// per session. All of it was then serialised into the page and thrown away by
// a component that reads five fields.
//
// That was invisible while this feed returned three sessions. Once the website
// and the Parent App started sharing PARENT_VISIBLE it became ~400KB of HTML
// and a ten-second Explore page. availabilityFor() only ever needed a booking
// COUNT, so a count is all this asks for.
// ---------------------------------------------------------------------------

export type CalendarMarker = {
  sessionId: string;
  offeringId: string;
  offeringName: string;
  /// Serialised here rather than left as a Date. ParentSessionCard.startTime is
  /// a Date, and the calendar only ever received a string because the old code
  /// ran every card through JSON.parse(JSON.stringify(...)). Being explicit
  /// means the client component's own type can say `string` and be believed.
  startTime: string;
  availability: Availability;
};

export async function loadCalendarMarkers(
  opts: { from?: Date; to?: Date } = {}
): Promise<CalendarMarker[]> {
  const now = new Date();

  const sessions = await prisma.session.findMany({
    where: {
      status: "scheduled",
      startTime: { gte: opts.from ?? facilityNow(), ...(opts.to ? { lt: opts.to } : {}) },
      offering: PARENT_VISIBLE,
    },
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      title: true,
      startTime: true,
      capacity: true,
      offering: {
        select: {
          id: true,
          name: true,
          status: true,
          registrationMode: true,
          registrationOpensAt: true,
          registrationClosesAt: true,
          closeWhenFull: true,
          waitlistMode: true,
          lowSpotThreshold: true,
        },
      },
      _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } },
    },
  });

  const markers: CalendarMarker[] = [];

  for (const s of sessions) {
    const o = s.offering;
    // Same gate as loadParentFeed: a per-session Book button only ever means
    // "buy this one occurrence", so camps and leagues stay out of this grid.
    if (!o || o.registrationMode !== "session") continue;

    markers.push({
      sessionId: s.id,
      offeringId: o.id,
      offeringName: s.title ?? o.name,
      startTime: s.startTime.toISOString(),
      availability: availabilityFor(
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
      ),
    });
  }

  return markers;
}
