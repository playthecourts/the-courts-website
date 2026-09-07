import "server-only";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Waitlist promotion.
//
// The rule that shapes this entire module: when a seat frees up, NOBODY is
// registered or charged automatically. The next family is OFFERED the spot and
// has a bounded window to accept. Silently enrolling a child and taking a
// payment because someone else dropped out is the behaviour this replaces.
//
// States: waiting → offered → accepted (→ converted) | declined | expired.
// An expired or declined offer moves to the next family in position order.
// ---------------------------------------------------------------------------

export type WaitlistOfferResult =
  | { kind: "offered"; athleteName: string; expiresAt: Date }
  | { kind: "nobody_waiting" }
  | { kind: "no_seat_free" }
  | { kind: "already_offered"; athleteName: string; expiresAt: Date };

/// Offers the freed seat to the next waiting family. Called when a booking is
/// cancelled or capacity increases — but only ever creates an OFFER.
export async function offerNextSpot(
  sessionId: string,
  actorId: string | null
): Promise<WaitlistOfferResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM sessions WHERE id = ${sessionId} FOR UPDATE`;

    const session = await tx.session.findUniqueOrThrow({
      where: { id: sessionId },
      select: { id: true, capacity: true, offering: { select: { waitlistMode: true, waitlistOfferHours: true } } },
    });

    if (session.offering?.waitlistMode === "none") return { kind: "nobody_waiting" as const };

    // An outstanding offer still holds the seat — don't hand the same seat to
    // two families and let them race for it.
    const outstanding = await tx.waitlistEntry.findFirst({
      where: { sessionId, status: "offered", offerExpiresAt: { gt: new Date() } },
      include: { athlete: { select: { firstName: true, lastName: true } } },
    });
    if (outstanding) {
      return {
        kind: "already_offered" as const,
        athleteName: `${outstanding.athlete.firstName} ${outstanding.athlete.lastName}`,
        expiresAt: outstanding.offerExpiresAt!,
      };
    }

    const booked = await tx.booking.count({
      where: { sessionId, status: { not: "cancelled" } },
    });
    if (booked >= session.capacity) return { kind: "no_seat_free" as const };

    const next = await tx.waitlistEntry.findFirst({
      where: { sessionId, status: "waiting" },
      orderBy: { position: "asc" },
      include: { athlete: { select: { firstName: true, lastName: true } } },
    });
    if (!next) return { kind: "nobody_waiting" as const };

    const hours = session.offering?.waitlistOfferHours ?? 24;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    await tx.waitlistEntry.update({
      where: { id: next.id },
      data: { status: "offered", offeredAt: new Date(), offerExpiresAt: expiresAt, offeredById: actorId },
    });

    return {
      kind: "offered" as const,
      athleteName: `${next.athlete.firstName} ${next.athlete.lastName}`,
      expiresAt,
    };
  });
}

/// A family accepting their offer. This is the only path from a waitlist entry
/// to a real booking, and it is always initiated by the family (or by an admin
/// acting explicitly on their behalf).
export async function acceptOffer(waitlistEntryId: string, acceptedByGuardianId: string | null) {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.waitlistEntry.findUniqueOrThrow({
      where: { id: waitlistEntryId },
      select: { id: true, sessionId: true, athleteId: true, status: true, offerExpiresAt: true },
    });

    if (entry.status !== "offered") {
      return { ok: false as const, reason: "That spot isn't currently offered." };
    }
    if (entry.offerExpiresAt && entry.offerExpiresAt < new Date()) {
      await tx.waitlistEntry.update({ where: { id: entry.id }, data: { status: "expired" } });
      return { ok: false as const, reason: "That offer expired." };
    }

    await tx.$executeRaw`SELECT id FROM sessions WHERE id = ${entry.sessionId} FOR UPDATE`;
    const session = await tx.session.findUniqueOrThrow({
      where: { id: entry.sessionId },
      select: { capacity: true },
    });
    const booked = await tx.booking.count({
      where: { sessionId: entry.sessionId, status: { not: "cancelled" } },
    });
    if (booked >= session.capacity) {
      return { ok: false as const, reason: "That session filled up before the offer was accepted." };
    }

    await tx.booking.upsert({
      where: { sessionId_athleteId: { sessionId: entry.sessionId, athleteId: entry.athleteId } },
      create: {
        sessionId: entry.sessionId,
        athleteId: entry.athleteId,
        bookedByGuardianId: acceptedByGuardianId,
        status: "booked",
      },
      update: { status: "booked", bookedAt: new Date(), bookedByGuardianId: acceptedByGuardianId },
    });

    await tx.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: "converted", respondedAt: new Date() },
    });

    return { ok: true as const };
  });
}

export async function declineOffer(waitlistEntryId: string, actorId: string | null) {
  const entry = await prisma.waitlistEntry.update({
    where: { id: waitlistEntryId },
    data: { status: "declined", respondedAt: new Date() },
    select: { sessionId: true },
  });
  if (actorId) await auditLog(actorId, "decline_waitlist", "waitlist_entry", waitlistEntryId);
  // The seat is free again — move to the next family.
  return offerNextSpot(entry.sessionId, actorId);
}

/// Sweeps offers past their window. Run on read of the admin waitlist view and
/// by any scheduled job — it is idempotent, so both is fine.
export async function expireStaleOffers(): Promise<number> {
  const stale = await prisma.waitlistEntry.findMany({
    where: { status: "offered", offerExpiresAt: { lt: new Date() } },
    select: { id: true, sessionId: true },
  });
  if (stale.length === 0) return 0;

  await prisma.waitlistEntry.updateMany({
    where: { id: { in: stale.map((s) => s.id) } },
    data: { status: "expired" },
  });

  // Each freed seat rolls to the next family in line.
  for (const sessionId of new Set(stale.map((s) => s.sessionId))) {
    await offerNextSpot(sessionId, null);
  }
  return stale.length;
}

export type WaitlistSummary = {
  waiting: number;
  offered: number;
  /// The outstanding offer, if any — what the admin view leads with.
  currentOffer: { athleteName: string; expiresAt: Date } | null;
};

export async function waitlistSummary(sessionId: string): Promise<WaitlistSummary> {
  const entries = await prisma.waitlistEntry.findMany({
    where: { sessionId, status: { in: ["waiting", "offered"] } },
    orderBy: { position: "asc" },
    include: { athlete: { select: { firstName: true, lastName: true } } },
  });
  const offered = entries.find((e) => e.status === "offered");
  return {
    waiting: entries.filter((e) => e.status === "waiting").length,
    offered: entries.filter((e) => e.status === "offered").length,
    currentOffer: offered
      ? {
          athleteName: `${offered.athlete.firstName} ${offered.athlete.lastName}`,
          expiresAt: offered.offerExpiresAt!,
        }
      : null,
  };
}
