import "server-only";
import { prisma } from "@/lib/prisma";
import { getBookingEligibility } from "@/lib/entitlements";

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

// Cancels a booking and, if a seat frees up, auto-promotes the oldest
// waiting waitlist entry into a real booking within the same transaction.
export async function cancelBookingById(bookingId: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (booking.status !== "booked") return;

    await tx.$executeRaw`SELECT id FROM sessions WHERE id = ${booking.sessionId} FOR UPDATE`;
    await tx.booking.update({ where: { id: bookingId }, data: { status: "cancelled" } });

    const nextWaiting = await tx.waitlistEntry.findFirst({
      where: { sessionId: booking.sessionId, status: "waiting" },
      orderBy: { position: "asc" },
    });
    if (!nextWaiting) return;

    // Same out-of-transaction eligibility call as bookAthleteIntoSession, and
    // for the same reason: entitlements.ts isn't parameterized for a tx
    // client, and a price computed a moment before commit is an acceptable
    // staleness window here (unlike the capacity check above it).
    const eligibility = await getBookingEligibility(nextWaiting.athleteId, booking.sessionId);
    const priceChargedCents = eligibility.type === "included" ? 0 : eligibility.priceCents;

    await tx.booking.upsert({
      where: {
        sessionId_athleteId: { sessionId: booking.sessionId, athleteId: nextWaiting.athleteId },
      },
      create: {
        sessionId: booking.sessionId,
        athleteId: nextWaiting.athleteId,
        status: "booked",
        priceChargedCents,
      },
      update: { status: "booked", bookedAt: new Date(), priceChargedCents },
    });
    await tx.waitlistEntry.update({ where: { id: nextWaiting.id }, data: { status: "converted" } });
  });
}

export async function cancelWaitlistEntryById(waitlistEntryId: string) {
  await prisma.waitlistEntry.delete({ where: { id: waitlistEntryId } });
}
