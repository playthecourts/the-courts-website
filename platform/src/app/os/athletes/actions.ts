"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getOsActor, assertAthleteAccess, requireCapability, OsAccessError } from "@/lib/os/dal";
import { can } from "@/lib/os/permissions";
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

/**
 * Comps a fixed number of drop-in class sessions to an athlete who has no
 * membership — same pack-credit mechanic already used for the Dr. Dish
 * 10-pack (see lib/programs/pricing.ts's uses_pack_credit case and
 * lib/booking.ts's consumption/restoration logic), just not scoped to one
 * program. Each grant is its own Credit row (never topped into an existing
 * one) so the ledger stays one entry per real decision to comp someone.
 */
export async function grantDropInCredits(athleteId: string, formData: FormData) {
  const actor = await requireCapability("plans.adjustCredits");
  await assertAthleteAccess(actor, athleteId);

  const quantity = Number(formData.get("quantity"));
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100) {
    throw new Error("Enter a whole number of credits between 1 and 100.");
  }
  const note = String(formData.get("note") ?? "").trim();

  const credit = await prisma.credit.create({
    data: {
      athleteId,
      creditType: "drop_in_pack",
      balance: quantity,
      status: "issued",
      source: note ? `Granted by ${actor.name} — ${note}` : `Granted by ${actor.name}`,
    },
  });

  await prisma.creditLedgerEntry.create({
    data: {
      creditId: credit.id,
      delta: quantity,
      balanceAfter: quantity,
      reason: note ? `Staff grant — ${note}` : "Staff grant",
      staffUserId: actor.id,
    },
  });

  revalidatePath(`/os/athletes/${athleteId}`);
}
