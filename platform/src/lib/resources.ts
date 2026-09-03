import "server-only";
import { Prisma } from "@/generated/prisma/client";

export class ResourceConflictError extends Error {
  constructor(resourceName: string) {
    super(`${resourceName} is already booked for part of that time range.`);
    this.name = "ResourceConflictError";
  }
}

// Locks the resource row, then checks both Sessions and ResourceReservations
// tied to it for any overlap with [startTime, endTime) — a resource can be
// used by a program-driven Session (e.g. Dr. Dish) or an ad-hoc rental, and
// "cannot be double-booked" has to hold across both. Must be called inside
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
  if (overlappingSession) throw new ResourceConflictError(resource.name);

  const overlappingReservation = await tx.resourceReservation.findFirst({
    where: {
      resourceId,
      status: "confirmed",
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });
  if (overlappingReservation) throw new ResourceConflictError(resource.name);
}
