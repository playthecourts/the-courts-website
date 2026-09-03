import "server-only";
import { prisma } from "@/lib/prisma";

export type BookingEligibility =
  | { type: "included"; membershipPlanName: string }
  | { type: "member_price"; priceCents: number | null; membershipPlanName: string }
  | { type: "full_price"; priceCents: number | null };

// Sunday-anchored week, matching the day-of-week convention used by the
// recurring session generator (0 = Sunday). UTC throughout, consistent with
// how session times are stored (see admin/programs/actions.ts).
function startOfWeekUTC(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d;
}

function endOfWeekUTC(date: Date) {
  const start = startOfWeekUTC(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
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

  // 1. class_credit: N sessions of this program included per week. Computed
  // dynamically by counting the athlete's own bookings in the current week
  // rather than a stored balance — see the Credit model's doc comment for
  // why that's the right call for this specific benefit type.
  for (const membership of memberships) {
    const entitlement = membership.plan.entitlements.find(
      (e) => e.benefitType === "class_credit" && e.programId === session.programId
    );
    if (entitlement?.quantityPerPeriod) {
      const weekStart = startOfWeekUTC(session.startTime);
      const weekEnd = endOfWeekUTC(session.startTime);
      const usedThisWeek = await prisma.booking.count({
        where: {
          athleteId,
          status: { not: "cancelled" },
          session: { programId: session.programId, startTime: { gte: weekStart, lt: weekEnd } },
        },
      });
      if (usedThisWeek < entitlement.quantityPerPeriod) {
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
