import "server-only";
import { prisma } from "@/lib/prisma";
import { getBookingEligibility } from "@/lib/entitlements";
import { offerNextSpot } from "@/lib/programs/waitlist";

// Shared booking logic used by both the guardian-facing action (after
// authorization) and, later, any admin-initiated booking. A raw
// `SELECT ... FOR UPDATE` on the session row serializes concurrent booking
// attempts for the same session so capacity can never be oversold — a
// plain count-then-create has a race window under concurrent requests.
export async function bookAthleteIntoSession(
  sessionId: string,
  athleteId: string,
  bookedByGuardianId: string | null
) {
  // Computed outside the transaction: entitlements.ts queries via the plain
  // prisma client, not the tx client below. A price computed a moment
  // before the capacity check is committed is an acceptable staleness
  // window (worst case: a slightly wrong charged price to fix manually) —
  // unlike the capacity check itself, which must never be stale.
  const eligibility = await getBookingEligibility(athleteId, sessionId);
  const priceChargedCents = eligibility.type === "included" ? 0 : eligibility.priceCents;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM sessions WHERE id = ${sessionId} FOR UPDATE`;

    const existing = await tx.booking.findUnique({
      where: { sessionId_athleteId: { sessionId, athleteId } },
    });
    // "not cancelled" rather than "booked" only: attended/no_show still
    // held a seat for this session, so it counts as already having one.
    if (existing && existing.status !== "cancelled") {
      return { status: "already_booked" as const };
    }

    const session = await tx.session.findUniqueOrThrow({ where: { id: sessionId } });
    const bookedCount = await tx.booking.count({
      where: { sessionId, status: { not: "cancelled" } },
    });

    if (bookedCount < session.capacity) {
      if (existing) {
        await tx.booking.update({
          where: { id: existing.id },
          data: {
            status: "booked",
            bookedByGuardianId,
            priceChargedCents,
            bookedAt: new Date(),
          },
        });
      } else {
        await tx.booking.create({
          data: { sessionId, athleteId, bookedByGuardianId, status: "booked", priceChargedCents },
        });
      }
      return { status: "booked" as const, eligibility };
    }

    const existingWaitlist = await tx.waitlistEntry.findUnique({
      where: { sessionId_athleteId: { sessionId, athleteId } },
    });
    if (existingWaitlist?.status === "waiting") {
      return { status: "already_waitlisted" as const };
    }

    const maxPosition = await tx.waitlistEntry.aggregate({
      where: { sessionId },
      _max: { position: true },
    });
    await tx.waitlistEntry.upsert({
      where: { sessionId_athleteId: { sessionId, athleteId } },
      create: { sessionId, athleteId, position: (maxPosition._max.position ?? 0) + 1 },
      update: { status: "waiting", position: (maxPosition._max.position ?? 0) + 1 },
    });
    return { status: "waitlisted" as const };
  });
}

// Cancels a booking. If a seat frees up, the next waiting family is OFFERED it
// — never booked and charged automatically.
//
// This used to auto-convert the oldest waitlist entry straight into a paid
// booking. That silently enrolled a child and charged a card because somebody
// else dropped out, which is not a decision this system gets to make on a
// family's behalf. Promotion is now an explicit, expiring offer; see
// lib/programs/waitlist.ts.
export async function cancelBookingById(bookingId: string) {
  const booking = await prisma.$transaction(async (tx) => {
    const found = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (found.status !== "booked") return null;

    await tx.$executeRaw`SELECT id FROM sessions WHERE id = ${found.sessionId} FOR UPDATE`;
    await tx.booking.update({ where: { id: bookingId }, data: { status: "cancelled" } });
    return found;
  });

  if (!booking) return;

  // Outside the transaction: offering a spot takes its own lock, and a failure
  // to notify the next family must not roll back the cancellation the family
  // in front of them already completed.
  await offerNextSpot(booking.sessionId, null);
}

export async function cancelWaitlistEntryById(waitlistEntryId: string) {
  await prisma.waitlistEntry.delete({ where: { id: waitlistEntryId } });
}
