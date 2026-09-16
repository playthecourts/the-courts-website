import "server-only";
import { prisma } from "@/lib/prisma";
import type { PlanEntitlement } from "@/generated/prisma/client";

/// A plan can point at another plan for its entitlements (Founders → Unlimited)
/// so benefits can never accidentally diverge — editing Unlimited's rows
/// changes what an inheriting plan grants too. Every real consumer of
/// `membership.plan.entitlements` should go through this instead of reading
/// the relation directly.
export function effectiveEntitlements(plan: {
  entitlements: PlanEntitlement[];
  entitlementsFromPlan?: { entitlements: PlanEntitlement[] } | null;
}): PlanEntitlement[] {
  return plan.entitlementsFromPlan?.entitlements ?? plan.entitlements;
}

export type BookingEligibility =
  | { type: "included"; membershipPlanName: string }
  | { type: "member_price"; priceCents: number | null; membershipPlanName: string }
  | { type: "full_price"; priceCents: number | null };

/**
 * The bounds of the billing period a session/booking falls into, anchored to
 * the day-of-month the membership actually started — NOT a calendar week or
 * calendar month. A family that subscribed on the 14th gets periods that run
 * 14th-to-14th, matching what Stripe actually bills them for, so "4 sessions
 * this period" means 4 sessions usable any time before their next renewal,
 * not reset every Sunday regardless of when they signed up.
 *
 * `annual` plans get the same anchor-day logic stepped by 12 months instead
 * of 1 — no plan uses that today, but nothing here assumes monthly.
 */
export function entitlementPeriodBounds(
  membership: { startDate: Date; plan: { billingInterval: string } },
  referenceDate: Date
): { start: Date; end: Date } {
  const anchorDay = membership.startDate.getUTCDate();
  const monthsPerPeriod = membership.plan.billingInterval === "annual" ? 12 : 1;

  // Clamps the anchor day to however many days that particular month
  // actually has (e.g. an anchor of the 31st lands on Feb 28/29 in a month
  // that short), so the period never drifts across months with fewer days.
  function periodStart(year: number, month: number): Date {
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(anchorDay, daysInMonth);
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }

  const year = referenceDate.getUTCFullYear();
  let month = referenceDate.getUTCMonth();
  let start = periodStart(year, month);
  if (start > referenceDate) {
    month -= monthsPerPeriod;
    start = periodStart(year, month);
  }
  const end = periodStart(year, month + monthsPerPeriod);

  return { start, end };
}

// The core "is this booking included, discounted, or full price" decision —
// computed from plan_entitlements data rather than hardcoded per-program
// logic, so a new membership plan doesn't require a code change.
export async function getBookingEligibility(
  athleteId: string,
  sessionId: string
): Promise<BookingEligibility> {
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: { program: true },
  });

  const memberships = await prisma.athleteMembership.findMany({
    where: { athleteId, status: "active" },
    include: { plan: { include: { entitlements: true, entitlementsFromPlan: { include: { entitlements: true } } } } },
  });

  // 1. class_credit: N sessions included per billing period — or every
  // session, if the entitlement row exists with quantityPerPeriod left null
  // (the "Unlimited Group Training" convention: the row marks the benefit as
  // granted without claiming a specific number, so no separate "unlimited"
  // enum value was needed).
  //
  // programId: null means the allowance is SHARED across every program
  // (e.g. one pool of 4 sessions usable on either Basketball or Volleyball
  // Development, not 4 of each separately) — same convention member_pricing
  // already uses below, extended to class_credit. A plan that wants a
  // program-specific allowance (Full Court's 2 Dr. Dish sessions/month) still
  // sets a real programId and is counted against only that program.
  //
  // Computed dynamically by counting the athlete's own bookings within the
  // current period rather than a stored balance — see the Credit model's doc
  // comment for why that's the right call for this specific benefit type.
  for (const membership of memberships) {
    const entitlement = effectiveEntitlements(membership.plan).find(
      (e) =>
        e.benefitType === "class_credit" &&
        (e.programId === null || e.programId === session.programId)
    );
    if (!entitlement) continue;
    if (entitlement.quantityPerPeriod === null) {
      return { type: "included", membershipPlanName: membership.plan.name };
    }
    const { start, end } = entitlementPeriodBounds(membership, session.startTime);
    const usedThisPeriod = await prisma.booking.count({
      where: {
        athleteId,
        OR: [{ status: { not: "cancelled" } }, { status: "cancelled", creditRestored: false, creditSource: { not: null } }],
        session: {
          ...(entitlement.programId ? { programId: entitlement.programId } : {}),
          startTime: { gte: start, lt: end },
        },
      },
    });
    if (usedThisPeriod < entitlement.quantityPerPeriod) {
      return { type: "included", membershipPlanName: membership.plan.name };
    }
  }

  // 2. member_pricing: applies to a specific program, or every program when
  // the entitlement's programId is null.
  for (const membership of memberships) {
    const entitlement = effectiveEntitlements(membership.plan).find(
      (e) =>
        e.benefitType === "member_pricing" &&
        (e.programId === null || e.programId === session.programId)
    );
    if (entitlement) {
      return {
        type: "member_price",
        priceCents: session.program.memberPriceCents ?? session.program.priceCents,
        membershipPlanName: membership.plan.name,
      };
    }
  }

  // 3. Default.
  return { type: "full_price", priceCents: session.program.priceCents };
}

export type SessionBalance = {
  membershipPlanName: string;
  // null means unlimited (see getBookingEligibility's class_credit comment)
  // — usedThisPeriod is not meaningful in that case and isn't computed.
  quantityPerPeriod: number | null;
  usedThisPeriod: number;
  periodEnd: Date;
};

// Powers the Home dashboard's "2 of 4 sessions remaining" line, the Family
// Account page's session-balance card, and the Coach App's roster label. Same
// class_credit accounting as getBookingEligibility above, but summed across
// all of an athlete's class_credit entitlements rather than checked against
// one session.
export async function getSessionBalances(athleteId: string): Promise<SessionBalance[]> {
  const memberships = await prisma.athleteMembership.findMany({
    where: { athleteId, status: "active" },
    include: { plan: { include: { entitlements: true, entitlementsFromPlan: { include: { entitlements: true } } } } },
  });

  const now = new Date();

  const balances: SessionBalance[] = [];
  for (const membership of memberships) {
    const { start, end } = entitlementPeriodBounds(membership, now);
    for (const entitlement of effectiveEntitlements(membership.plan)) {
      if (entitlement.benefitType !== "class_credit") continue;

      if (entitlement.quantityPerPeriod === null) {
        balances.push({
          membershipPlanName: membership.plan.name,
          quantityPerPeriod: null,
          usedThisPeriod: 0,
          periodEnd: end,
        });
        continue;
      }

      // A cancelled booking still counts unless its credit was actually
      // restored (cancelled >= the refund cutoff before the session started
      // — see cancelBookingById in lib/booking.ts). Kept in sync with the
      // same rule resolveBookingRule uses for the live booking decision.
      const usedThisPeriod = await prisma.booking.count({
        where: {
          athleteId,
          OR: [{ status: { not: "cancelled" } }, { status: "cancelled", creditRestored: false, creditSource: { not: null } }],
          session: {
            ...(entitlement.programId ? { programId: entitlement.programId } : {}),
            startTime: { gte: start, lt: end },
          },
        },
      });

      balances.push({
        membershipPlanName: membership.plan.name,
        quantityPerPeriod: entitlement.quantityPerPeriod,
        usedThisPeriod,
        periodEnd: end,
      });
    }
  }
  return balances;
}
