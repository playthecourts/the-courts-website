import "server-only";
import { Prisma } from "@/generated/prisma/client";

export class ResourceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceConflictError";
  }

  /// Errors in Courts OS say what collided and when, not just "conflict" —
  /// the admin needs to know which booking to move.
  static booked(resourceName: string, start: Date, end: Date) {
    return new ResourceConflictError(
      `Couldn't save this because ${resourceName} is already booked from ${fmt(start)}–${fmt(end)}.`
    );
  }

  static blocked(resourceName: string, reason: string, start: Date, end: Date) {
    return new ResourceConflictError(
      `Couldn't save this because ${resourceName} is blocked for ${reason.replace(/_/g, " ")} from ${fmt(start)}–${fmt(end)}.`
    );
  }
}

function fmt(d: Date): string {
  return d
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Chicago",
    })
    .replace(":00", "");
}

// Locks the resource row, then checks Sessions, ResourceReservations AND
// FacilityBlocks tied to it for any overlap with [startTime, endTime) — a
// resource can be taken by a program-driven Session (e.g. Dr. Dish), an ad-hoc
// rental, or a maintenance/holiday block, and "cannot be double-booked" has to
// hold across all three. Must be called inside
// an open transaction so the lock actually serializes concurrent attempts;
// the caller creates the Session/ResourceReservation row itself right after
// this returns without throwing, same lock-then-check-then-act shape as
// bookAthleteIntoSession in lib/booking.ts.
export async function assertResourceAvailable(
  tx: Prisma.TransactionClient,
  resourceId: string,
  startTime: Date,
  endTime: Date,
  excludeSessionId?: string
) {
  const resource = await tx.resource.findUniqueOrThrow({ where: { id: resourceId } });
  await tx.$executeRaw`SELECT id FROM resources WHERE id = ${resourceId} FOR UPDATE`;

  const overlappingSession = await tx.session.findFirst({
    where: {
      resourceId,
      status: "scheduled",
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
    },
  });
  if (overlappingSession)
    throw ResourceConflictError.booked(
      resource.name,
      overlappingSession.startTime,
      overlappingSession.endTime
    );

  const overlappingReservation = await tx.resourceReservation.findFirst({
    where: {
      resourceId,
      status: "confirmed",
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });
  if (overlappingReservation)
    throw ResourceConflictError.booked(
      resource.name,
      overlappingReservation.startTime,
      overlappingReservation.endTime
    );

  // Facility blocks (maintenance, holidays, owner blocks) make a court
  // unavailable just as firmly as a booking does. A block with a null
  // resourceId closes the WHOLE facility, so it blocks every resource.
  const overlappingBlock = await tx.facilityBlock.findFirst({
    where: {
      OR: [{ resourceId }, { resourceId: null }],
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });
  if (overlappingBlock)
    throw ResourceConflictError.blocked(
      overlappingBlock.resourceId ? resource.name : "The facility",
      overlappingBlock.reason,
      overlappingBlock.startTime,
      overlappingBlock.endTime
    );
}
