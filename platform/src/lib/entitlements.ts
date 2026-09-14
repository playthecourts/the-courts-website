import "server-only";
import { prisma } from "@/lib/prisma";

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
    include: { plan: { include: { entitlements: true } } },
  });

  // 1. class_credit: N sessions of this program included per billing period.
  // Computed dynamically by counting the athlete's own bookings within the
  // current period rather than a stored balance — see the Credit model's doc
  // comment for why that's the right call for this specific benefit type.
  for (const membership of memberships) {
    const entitlement = membership.plan.entitlements.find(
      (e) => e.benefitType === "class_credit" && e.programId === session.programId
    );
    if (entitlement?.quantityPerPeriod) {
      const { start, end } = entitlementPeriodBounds(membership, session.startTime);
      const usedThisPeriod = await prisma.booking.count({
        where: {
          athleteId,
          status: { not: "cancelled" },
          session: { programId: session.programId, startTime: { gte: start, lt: end } },
        },
      });
      if (usedThisPeriod < entitlement.quantityPerPeriod) {
        return { type: "included", membershipPlanName: membership.plan.name };
      }
    }
  }

  // 2. member_pricing: applies to a specific program, or every program when
  // the entitlement's programId is null.
  for (const membership of memberships) {
    const entitlement = membership.plan.entitlements.find(
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
  quantityPerPeriod: number;
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
    include: { plan: { include: { entitlements: true } } },
  });

  const now = new Date();

  const balances: SessionBalance[] = [];
  for (const membership of memberships) {
    const { start, end } = entitlementPeriodBounds(membership, now);
    for (const entitlement of membership.plan.entitlements) {
      if (entitlement.benefitType !== "class_credit" || !entitlement.quantityPerPeriod) continue;

      const usedThisPeriod = await prisma.booking.count({
        where: {
          athleteId,
          status: { not: "cancelled" },
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
