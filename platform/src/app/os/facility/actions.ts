"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/os/dal";
import { auditLog } from "@/lib/audit";
import { localDateTime, str } from "@/lib/programs/actions-shared";

// Closing the facility is consequential: it can invalidate sessions families
// have already booked. So this action reports what it affects and NEVER cancels
// or notifies on its own — an admin reviews the affected sessions and decides.

export async function createFacilityBlock(_prev: unknown, formData: FormData) {
  const actor = await requireCapability("facility.block");

  const start = localDateTime(formData, "startTime");
  const end = localDateTime(formData, "endTime");
  if (!start || !end) return { error: "Pick a start and end time." };
  if (end <= start) return { error: "The end time has to be after the start." };

  const resourceId = str(formData, "resourceId");
  const reason = (str(formData, "reason") ?? "other") as never;

  const block = await prisma.facilityBlock.create({
    data: {
      resourceId,
      startTime: start,
      endTime: end,
      reason,
      note: str(formData, "note"),
      createdById: actor.id,
    },
  });

  // Identify everything already scheduled inside the closure. Reported, not
  // acted on — mass-cancelling sessions and notifying families is a decision a
  // human makes deliberately, one at a time.
  const affected = await prisma.session.findMany({
    where: {
      status: "scheduled",
      startTime: { lt: end },
      endTime: { gt: start },
      ...(resourceId
        ? {
            OR: [
              { resourceId },
              { extraResources: { some: { resourceId } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      startTime: true,
      offering: { select: { id: true, name: true } },
      program: { select: { name: true } },
      _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } },
    },
    orderBy: { startTime: "asc" },
  });

  await auditLog(actor.id, "block_facility", "facility_block", block.id, {
    reason,
    affectedSessions: affected.length,
  });

  revalidatePath("/os/facility");
  revalidatePath("/os/schedule");

  return {
    ok: true as const,
    blockId: block.id,
    affected: affected.map((s) => ({
      id: s.id,
      offeringId: s.offering?.id ?? null,
      name: s.offering?.name ?? s.program.name,
      start: s.startTime.toISOString(),
      registrations: s._count.bookings,
    })),
  };
}

export async function removeFacilityBlock(blockId: string) {
  const actor = await requireCapability("facility.block");
  await prisma.facilityBlock.delete({ where: { id: blockId } });
  await auditLog(actor.id, "block_facility", "facility_block", blockId, { removed: true });
  revalidatePath("/os/facility");
  revalidatePath("/os/schedule");
}
