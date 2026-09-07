"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getOsActor, assertAthleteAccess, OsAccessError } from "@/lib/os/dal";
import { can } from "@/lib/os/permissions";
import { auditLog } from "@/lib/audit";
import { recordProfileChange } from "@/lib/athlete-profile";

/**
 * Writes the one line a coach is allowed to see about a pickup restriction.
 *
 * This is the hinge of the custody design: the parent writes the situation, an
 * authorized staff member translates it into an instruction ("Do not release
 * athlete to an unauthorized adult"), and only that translation reaches the
 * Coach App. Nothing automatic derives it — a machine summary of a custody
 * arrangement is exactly the wrong thing to put in front of a coach at pickup.
 */
export async function setPickupInstruction(athleteId: string, formData: FormData) {
  const actor = await getOsActor();
  await assertAthleteAccess(actor, athleteId);

  // Gated on the custody capability, not athletes.edit: writing this line
  // requires having been allowed to read the thing it summarises.
  if (!can(actor, "athletes.viewCustody")) {
    throw new OsAccessError("Only owner, admin and front desk can set a pickup instruction.");
  }

  const instruction = String(formData.get("instruction") ?? "").trim() || null;

  const before = await prisma.athlete.findUniqueOrThrow({
    where: { id: athleteId },
    select: { custodyStaffInstruction: true },
  });

  await prisma.athlete.update({
    where: { id: athleteId },
    data: { custodyStaffInstruction: instruction },
  });

  await auditLog(actor.id, "set_pickup_instruction", "athlete", athleteId);
  await recordProfileChange({
    athleteId,
    actor: { type: "staff", id: actor.id, label: actor.name },
    category: "custody",
    field: "coach_pickup_instruction",
    oldValue: before.custodyStaffInstruction,
    newValue: instruction,
  });

  revalidatePath(`/os/athletes/${athleteId}`);
  revalidatePath(`/coach/athletes/${athleteId}`);
}
