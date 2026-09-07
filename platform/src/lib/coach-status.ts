import "server-only";
import { prisma } from "@/lib/prisma";
import { getWeeklySessionBalances } from "@/lib/entitlements";

// ---------------------------------------------------------------------------
// Operational status, translated into Courts terms.
//
// The rule this file exists to enforce: a coach never sees payment data, and a
// coach is never asked to interpret a Stripe subscription. Everything here is
// derived from records the platform already owns (AthleteMembership.status,
// Booking, PlanEntitlement) and reduced to the handful of words that change
// what a coach does courtside — "Registered", "Payment Required".
//
// What is deliberately NOT reachable from anything in this module: card
// numbers, brands, last4, billing addresses, Stripe customer/subscription/
// price IDs, transaction IDs, amounts paid, or family payment history. None of
// those are selected, and none are returned. The only Stripe-derived fact that
// crosses into the Coach App is the single word `past_due`, mapped to
// "Payment Required" — which is operational, not financial.
// ---------------------------------------------------------------------------

export type RegistrationStatus =
  | { label: "Registered"; tone: "ok" }
  | { label: "Payment Required"; tone: "warn" }
  | { label: "Registration Pending"; tone: "warn" }
  | { label: "Drop-In"; tone: "neutral" };

/**
 * Registration/payment state for one athlete in one session, in the four words
 * a coach can actually act on.
 */
export function registrationStatusFor(
  bookingStatus: string,
  membershipPastDue: boolean
): RegistrationStatus {
  if (membershipPastDue) return { label: "Payment Required", tone: "warn" };
  if (bookingStatus === "booked" || bookingStatus === "attended" || bookingStatus === "no_show") {
    return { label: "Registered", tone: "ok" };
  }
  return { label: "Registration Pending", tone: "warn" };
}

export type TrainingPlanStatus =
  | { kind: "covered"; planName: string; remaining: number; total: number }
  | { kind: "exhausted"; planName: string; total: number }
  | { kind: "none" };

/**
 * "Weekly Training Plan — 2 sessions remaining" / "Session Not Covered".
 *
 * Reuses getWeeklySessionBalances() rather than recomputing entitlement math,
 * so the Coach App and the Parent App can never disagree about how many
 * sessions a family has left this week.
 */
export async function trainingPlanStatusFor(athleteId: string): Promise<TrainingPlanStatus> {
  const balances = await getWeeklySessionBalances(athleteId);
  if (balances.length === 0) return { kind: "none" };

  const best = balances.reduce((a, b) =>
    b.quantityPerPeriod - b.usedThisWeek > a.quantityPerPeriod - a.usedThisWeek ? b : a
  );
  const remaining = best.quantityPerPeriod - best.usedThisWeek;

  if (remaining <= 0) {
    return { kind: "exhausted", planName: best.membershipPlanName, total: best.quantityPerPeriod };
  }
  return {
    kind: "covered",
    planName: best.membershipPlanName,
    remaining,
    total: best.quantityPerPeriod,
  };
}

/**
 * Which athletes in a set have a membership Stripe has marked past_due.
 * Returns a Set of athlete ids and nothing else — no amounts, no plan pricing,
 * no Stripe identifiers leave this function.
 */
export async function pastDueAthleteIds(athleteIds: string[]): Promise<Set<string>> {
  if (athleteIds.length === 0) return new Set();
  const rows = await prisma.athleteMembership.findMany({
    where: { athleteId: { in: athleteIds }, status: "past_due" },
    select: { athleteId: true },
  });
  return new Set(rows.map((r) => r.athleteId));
}

/** Capacity line for a session: "6 / 8 Registered" or "FULL". */
export function capacityLabel(booked: number, capacity: number) {
  if (booked >= capacity) return "FULL";
  return `${booked} / ${capacity} Registered`;
}
