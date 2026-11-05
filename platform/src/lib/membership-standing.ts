import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Past-due memberships and booking.
//
// When a renewal charge fails, Stripe marks the subscription past_due and
// keeps retrying for a while. Two rules follow from that:
//
//   1. Grace: for PAST_DUE_GRACE_DAYS after the membership first went
//      past_due, it still counts as a membership for booking — classes stay
//      included, member pricing still applies. A card that expired yesterday
//      shouldn't bounce a family out of tonight's class.
//
//   2. After the grace period, the athlete can't make NEW bookings at all
//      (sessions, camps, events, waitlist offers) until the card is fixed.
//      They are NOT quietly downgraded to drop-in pricing — that just charged
//      a member full price for what their membership should cover. Existing
//      bookings are left alone.
//
// past_due_since is set by the Stripe webhook the moment a membership flips
// into past_due and cleared when it leaves. A past_due row with no
// past_due_since (webhook missed) is treated as already past the grace period.
// ---------------------------------------------------------------------------

export const PAST_DUE_GRACE_DAYS = 5;

export const PAYMENT_BLOCKED_MESSAGE =
  "Your membership payment didn't go through. Update your card to keep booking.";

function graceCutoff(now: Date): Date {
  return new Date(now.getTime() - PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000);
}

/// `where` fragment for "memberships that count for booking right now":
/// active, or past_due but still inside the grace period. Use this anywhere
/// that used to filter on `status: "active"` to decide what a booking costs
/// or whether a member-only program is open to this athlete.
export function bookableMembershipWhere(now: Date = new Date()): Prisma.AthleteMembershipWhereInput {
  return {
    OR: [
      { status: "active" },
      { status: "past_due", pastDueSince: { gte: graceCutoff(now) } },
    ],
  };
}

/// `where` fragment for memberships whose grace period has run out — the
/// ones that block new bookings.
export function blockingPastDueWhere(now: Date = new Date()): Prisma.AthleteMembershipWhereInput {
  return {
    status: "past_due",
    OR: [{ pastDueSince: null }, { pastDueSince: { lt: graceCutoff(now) } }],
  };
}

/// Which of these athletes are blocked from new bookings right now.
export async function paymentBlockedAthleteIds(athleteIds: string[]): Promise<Set<string>> {
  if (athleteIds.length === 0) return new Set();
  const rows = await prisma.athleteMembership.findMany({
    where: { athleteId: { in: athleteIds }, ...blockingPastDueWhere() },
    select: { athleteId: true },
  });
  return new Set(rows.map((r) => r.athleteId));
}

export async function isPaymentBlocked(athleteId: string): Promise<boolean> {
  return (await paymentBlockedAthleteIds([athleteId])).has(athleteId);
}
