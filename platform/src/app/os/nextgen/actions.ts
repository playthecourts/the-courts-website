"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/os/dal";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";

/// Neither this nor markNotEligible touches Stripe. A former_nextgen
/// guardian already self-served checkout at signup (their price was already
/// known) — verification here is pure record-keeping against the official
/// NextGen list, not an enforcement action. Cancelling/repricing an
/// already-subscribed family who turns out not_eligible is a deliberate
/// human/business decision, never automatic.
export async function verifyFormerNextGen(guardianId: string) {
  const actor = await requireCapability("nextgen.verify");

  const guardian = await prisma.guardian.findUniqueOrThrow({ where: { id: guardianId } });
  if (guardian.nextGenStatus !== "former_nextgen") {
    throw new Error("This guardian isn't a former NextGen self-report.");
  }

  await prisma.guardian.update({
    where: { id: guardianId },
    data: { nextGenVerification: "verified", isFounder: true },
  });

  await auditLog(actor.id, "verify_nextgen_founder", "guardian", guardianId);
  revalidatePath("/os/nextgen");
}

export async function markNotEligible(guardianId: string) {
  const actor = await requireCapability("nextgen.verify");

  const guardian = await prisma.guardian.findUniqueOrThrow({ where: { id: guardianId } });
  if (guardian.nextGenStatus === null) {
    throw new Error("This guardian never self-reported a NextGen status.");
  }

  await prisma.guardian.update({
    where: { id: guardianId },
    data: { nextGenVerification: "not_eligible" },
  });

  await auditLog(actor.id, "mark_nextgen_not_eligible", "guardian", guardianId);
  revalidatePath("/os/nextgen");
}

/// Current-NextGen only. Sets the real legacy rate AND verifies in one
/// action — a "verified with no rate" intermediate state should never be
/// reachable. Does NOT create a Stripe subscription: this guardian has no
/// payment method on file (they skipped checkout at signup by design), so
/// this only unlocks startNextGenLegacyCheckout — the family must click it
/// and enter a card themselves.
export async function setLegacyRate(guardianId: string, formData: FormData) {
  const actor = await requireCapability("nextgen.verify");

  const guardian = await prisma.guardian.findUniqueOrThrow({ where: { id: guardianId } });
  if (guardian.nextGenStatus !== "current_nextgen") {
    throw new Error("This guardian isn't a current NextGen self-report.");
  }

  const dollars = Number(formData.get("legacyRate"));
  if (!Number.isFinite(dollars) || dollars <= 0) {
    throw new Error("Enter a valid monthly rate.");
  }
  const legacyRateCents = Math.round(dollars * 100);

  await prisma.guardian.update({
    where: { id: guardianId },
    data: { legacyRateCents, nextGenVerification: "verified" },
  });

  await auditLog(actor.id, "set_nextgen_legacy_rate", "guardian", guardianId, { legacyRateCents });
  revalidatePath("/os/nextgen");
}
