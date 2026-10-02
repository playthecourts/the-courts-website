import "server-only";
import { prisma } from "@/lib/prisma";
import { facilityNow } from "@/lib/facility-time";
import { getUnsignedRequiredWaivers } from "@/lib/waivers";
import { completeness } from "@/lib/athlete";
import type { getCurrentGuardian } from "@/lib/dal";

// Action Needed — the ONE list of things a family genuinely still has to do.
//
// Every item here is something incomplete or required, never a nudge to buy
// more. An explicit "No" (Photo/Video, custody, medical) is a finished
// answer, so only a missing answer ever shows up. Each item carries its own
// contextual CTA ("Pay $25", "Sign Waivers") and a real destination, and
// where the existing app already has a one-tap server action for the job
// (resuming a booking's Checkout, opening the Stripe billing portal), the
// item names it so Home can submit it directly instead of adding a hop.
//
// Ordered by what goes stale first: a held waitlist spot expires, a held
// paid seat expires, a failed card stops a membership — then the paperwork.

export type ActionNeededTone = "urgent" | "default";

export type ActionNeededAction =
  | { kind: "payBooking"; bookingId: string }
  | { kind: "billingPortal" };

export type ActionNeededItem = {
  key: string;
  title: string;
  detail: string;
  cta: string;
  /// Always set — the fallback destination, and the only one for items with
  /// no `action`.
  href: string;
  tone: ActionNeededTone;
  action?: ActionNeededAction;
};

type Guardian = Awaited<ReturnType<typeof getCurrentGuardian>>;

const LEAGUE_OFFERING_NAME = "Fall 2026 Basketball League";
const LEAGUE_DISPLAY_NAME = "Fall League";
// Mirrors payments/page.tsx — the real EVAL25 credit applied at League checkout.
const EVAL_CREDIT_CENTS = 2500;

function formatPrice(cents: number) {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

// Session times are Central wall-clock stored in UTC fields — format in UTC.
function formatSessionTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

// Offer expiry is a real instant (set from new Date()), so show it in Central.
function formatRealTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }).format(date);
}

function campAnchor(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export async function getParentActionNeeded(guardian: Guardian): Promise<ActionNeededItem[]> {
  // Same "first family only" assumption as the rest of the Parent App
  // (layout.tsx, Home).
  const athletes = guardian.families[0]?.family.athletes ?? [];
  // No athletes means nothing else here can apply — and nothing can be booked
  // until there is one, so that IS the action.
  if (athletes.length === 0) {
    return [
      {
        key: "add-athlete",
        title: "Add your first athlete",
        detail: "Everything else — booking, waivers, membership — starts here.",
        cta: "Add Athlete",
        href: "/my-courts/athletes/new",
        tone: "default",
      },
    ];
  }
  const athleteIds = athletes.map((a) => a.id);
  const realNow = new Date();
  const now = facilityNow(realNow);

  const [
    offers,
    pendingBookings,
    pastDueMemberships,
    unpaidRegistrations,
    leagueRegistrations,
    activeMemberships,
    emergencyContactCounts,
    mediaConsents,
    unsignedByAthlete,
  ] = await Promise.all([
    prisma.waitlistEntry.findMany({
      where: {
        athleteId: { in: athleteIds },
        status: "offered",
        offerExpiresAt: { gt: realNow },
        session: { status: "scheduled", startTime: { gte: now } },
      },
      include: {
        session: { include: { program: true, offering: true } },
        athlete: { select: { firstName: true } },
      },
      orderBy: { offerExpiresAt: "asc" },
    }),
    // Only `pending` — that's the state resumeBookingCheckout (payBooking)
    // can actually resume, and the same set Payments lists as due. A seat
    // whose Checkout already expired is about to be swept, not paid.
    prisma.booking.findMany({
      where: {
        athleteId: { in: athleteIds },
        status: { not: "cancelled" },
        paymentStatus: "pending",
        priceChargedCents: { gt: 0 },
        // A class that already happened is never a "pay now" item.
        session: { startTime: { gte: now } },
        OR: [{ checkoutExpiresAt: null }, { checkoutExpiresAt: { gt: realNow } }],
      },
      include: {
        session: { include: { program: true, offering: true } },
        athlete: { select: { firstName: true } },
      },
      orderBy: { bookedAt: "asc" },
    }),
    prisma.athleteMembership.findMany({
      where: { athleteId: { in: athleteIds }, status: "past_due" },
      include: { plan: true, athlete: { select: { firstName: true } } },
    }),
    prisma.registration.findMany({
      where: {
        athleteId: { in: athleteIds },
        status: { not: "cancelled" },
        paymentStatus: { in: ["due", "pending", "failed"] },
      },
      include: { offering: { include: { program: true } }, athlete: { select: { firstName: true } } },
      orderBy: { registeredAt: "asc" },
    }),
    prisma.registration.findMany({
      where: {
        athleteId: { in: athleteIds },
        status: { not: "cancelled" },
        offering: { name: LEAGUE_OFFERING_NAME },
      },
      include: { athlete: { select: { firstName: true, id: true } } },
    }),
    prisma.athleteMembership.findMany({
      where: { athleteId: { in: athleteIds }, status: "active" },
      select: { athleteId: true },
    }),
    prisma.emergencyContact.groupBy({
      by: ["athleteId"],
      where: { athleteId: { in: athleteIds } },
      _count: { athleteId: true },
    }),
    prisma.mediaConsent.findMany({ where: { athleteId: { in: athleteIds } }, select: { athleteId: true } }),
    Promise.all(
      athletes.map(async (a) => ({ athlete: a, unsigned: await getUnsignedRequiredWaivers(guardian.id, a.id) }))
    ),
  ]);

  const items: ActionNeededItem[] = [];

  // 1. Waitlist offers — a held spot that expires to the next family.
  for (const o of offers) {
    const className = o.session.title ?? o.session.offering?.name ?? o.session.program.name;
    items.push({
      key: `offer-${o.id}`,
      title: `A spot opened in ${className}`,
      detail: `${o.athlete.firstName} · ${formatSessionTime(o.session.startTime)}${
        o.offerExpiresAt ? ` · held until ${formatRealTime(o.offerExpiresAt)}` : ""
      }`,
      cta: "Take the Spot",
      href: o.session.offeringId
        ? `/my-courts/explore?offering=${o.session.offeringId}`
        : "/my-courts/explore?when=anytime",
      tone: "urgent",
    });
  }

  // 2. Paid seats being held for a payment that never finished.
  for (const b of pendingBookings) {
    const className = b.session.title ?? b.session.offering?.name ?? b.session.program.name;
    items.push({
      key: `booking-${b.id}`,
      title: `Pay ${formatPrice(b.priceChargedCents!)} for ${className}`,
      detail: `${b.athlete.firstName} · ${formatSessionTime(b.session.startTime)} · seat held until paid`,
      cta: `Pay ${formatPrice(b.priceChargedCents!)}`,
      href: "/my-courts/payments",
      tone: "urgent",
      action: { kind: "payBooking", bookingId: b.id },
    });
  }

  // 3. A membership whose card didn't go through.
  for (const m of pastDueMemberships) {
    items.push({
      key: `pastdue-${m.id}`,
      title: "Update your card",
      detail: `${m.athlete.firstName}'s ${m.plan.name} payment didn't go through.`,
      cta: "Update Card",
      href: "/my-courts/payments",
      tone: "urgent",
      action: guardian.stripeCustomerId ? { kind: "billingPortal" } : undefined,
    });
  }

  // 4. Registrations (League, camps) started but not paid.
  for (const r of unpaidRegistrations) {
    const isFallLeague = r.offering.name === LEAGUE_OFFERING_NAME;
    const isLeague = isFallLeague || r.offering.program.programType === "league";
    const isCamp = r.offering.program.programType === "camp" || r.offering.program.programType === "event";
    const amount = isFallLeague
      ? (r.offering.priceCents ?? 0) - EVAL_CREDIT_CENTS
      // Same amount the Payments page shows for this registration.
      : (r.offering.priceCents ?? 0);
    if (amount <= 0) continue;
    const name = isFallLeague ? LEAGUE_DISPLAY_NAME : r.offering.name;
    items.push({
      key: `registration-${r.id}`,
      title: `Pay ${formatPrice(amount)} for ${name}`,
      detail:
        r.paymentStatus === "failed"
          ? `${r.athlete.firstName} · your last payment attempt didn't go through.`
          : `${r.athlete.firstName} · registration isn't final until it's paid.`,
      cta: `Pay ${formatPrice(amount)}`,
      href: isLeague
        ? "/my-courts/league"
        : isCamp
          ? `/my-courts/camps#${campAnchor(r.offering.name)}`
          : "/my-courts/payments",
      tone: r.paymentStatus === "failed" ? "urgent" : "default",
    });
  }

  // 5. Required waivers — one item for the family, not one per form.
  const needsWaivers = unsignedByAthlete.filter((u) => u.unsigned.length > 0).map((u) => u.athlete.firstName);
  if (needsWaivers.length > 0) {
    items.push({
      key: "waivers",
      title: "Sign required waivers",
      detail: `Needed for ${joinNames(needsWaivers)} before they can book. Takes about two minutes.`,
      cta: "Sign Waivers",
      href: "/my-courts/waivers",
      tone: "default",
    });
  }

  // 6. League eligibility (existing Home logic, unchanged).
  const activeMembershipAthleteIds = new Set(activeMemberships.map((m) => m.athleteId));
  for (const r of leagueRegistrations) {
    // A paid League seat whose bundled membership didn't finish setting up
    // takes priority — "Choose Plan" would send them through checkout again.
    if (r.membershipSetupNeeded) {
      items.push({
        key: `league-setup-${r.id}`,
        title: `Finish setting up ${r.athlete.firstName}'s membership`,
        detail: "League is paid — the membership that comes with it just needs one more step.",
        cta: "Finish Setup",
        href: "/my-courts/league",
        tone: "default",
      });
      continue;
    }
    if (activeMembershipAthleteIds.has(r.athlete.id)) continue;
    items.push({
      key: `league-plan-${r.id}`,
      title: `Choose a plan for ${r.athlete.firstName}`,
      detail: "Fall League requires a Weekly membership or higher to stay eligible.",
      cta: "Choose Plan",
      href: `/my-courts/memberships?required=league&athlete=${r.athlete.id}`,
      tone: "default",
    });
  }

  // 7. Player Card + emergency contacts (existing completeness logic).
  const contactCounts = new Map<string, number>(emergencyContactCounts.map((row) => [row.athleteId, row._count.athleteId]));
  for (const athlete of athletes) {
    const { nextStep } = completeness(
      {
        goal: athlete.goal,
        coachingPreferences: athlete.coachingPreferences,
        competitiveMeter: athlete.competitiveMeter,
        emergencyContactCount: contactCounts.get(athlete.id) ?? 0,
      },
      athlete.id
    );
    if (!nextStep) continue;
    if (nextStep.key === "emergency-primary" || nextStep.key === "emergency-backup") {
      const backup = nextStep.key === "emergency-backup";
      items.push({
        key: `profile-${athlete.id}`,
        title: backup ? `Add a backup contact for ${athlete.firstName}` : `Add an emergency contact for ${athlete.firstName}`,
        detail: backup
          ? "Someone we can call if the primary guardian can't be reached."
          : "Who we call first if something happens on the court.",
        cta: "Add Contact",
        href: nextStep.href,
        tone: "default",
      });
    } else {
      items.push({
        key: `profile-${athlete.id}`,
        title: `Finish ${athlete.firstName}'s Player Card`,
        detail: `Next up: ${nextStep.label}.`,
        cta: "Continue",
        href: nextStep.href,
        tone: "default",
      });
    }
  }

  // 8. Photo + Video permission with no answer yet. "No" is a complete
  // answer — only a missing one lands here.
  const answered = new Set(mediaConsents.map((c) => c.athleteId));
  const unanswered = athletes.filter((a) => !answered.has(a.id)).map((a) => a.firstName);
  if (unanswered.length > 0) {
    items.push({
      key: "media",
      title: "Photo + video permission",
      detail: `Yes or no for ${joinNames(unanswered)} — either answer is fine, we just need one.`,
      cta: "Choose Yes or No",
      href: "/my-courts/waivers",
      tone: "default",
    });
  }

  return items;
}
