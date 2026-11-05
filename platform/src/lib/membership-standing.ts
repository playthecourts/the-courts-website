import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Past-due memberships and booking.
//
// When a renewal charge fails, Stripe marks the subscription past_due. From
// that moment the athlete can't make NEW bookings (sessions, waitlist offers,
// camps, league) until the card is fixed — no grace period (Melissa's call:
// repeat insufficient-funds cases shouldn't get free days). They are NOT
// quietly downgraded to drop-in pricing either; that just charged a member
// full price for what their membership should cover. Existing bookings are
// left alone.
//
// past_due_since (set/cleared by the Stripe webhook) records when it started;
// it isn't used for the block today, but is there if a grace period is ever
// wanted again.
// ---------------------------------------------------------------------------

export const PAYMENT_BLOCKED_MESSAGE =
  "Your membership payment didn't go through. Update your card to keep booking.";

/// `where` fragment for "memberships that count for booking right now".
/// Only active ones — a past_due membership blocks booking outright.
export function bookableMembershipWhere(): Prisma.AthleteMembershipWhereInput {
  return { status: "active" };
}

/// `where` fragment for memberships that block new bookings.
export function blockingPastDueWhere(): Prisma.AthleteMembershipWhereInput {
  return { status: "past_due" };
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
