"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/os/dal";
import { auditLog } from "@/lib/audit";

/// Puts a family on the NextGen Founders Legacy rate ($165/mo) when they never
/// self-reported NextGen at signup — the owner knows they were a NextGen
/// family. Same end state as a self-reported current NextGen family that admin
/// approved: their My Courts → Membership page shows "Complete Your Transfer
/// — $165.00/mo" instead of the regular plans, and they appear on the NextGen
/// page. Never touches Stripe; the family checks out themselves.
export async function approveNextGenLegacyRate(guardianId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const actor = await requireCapability("nextgen.verify");
    const g = await prisma.guardian.findUnique({ where: { id: guardianId }, select: { nextGenStatus: true } });
    if (!g) return { ok: false, error: "That parent no longer exists." };
    if (g.nextGenStatus) return { ok: false, error: "This family is already on the NextGen list — set their rate on the NextGen page." };
    await prisma.guardian.update({
      where: { id: guardianId },
      data: { nextGenStatus: "current_nextgen", nextGenVerification: "admin_approved", isFounder: true, legacyRateCents: 16500 },
    });
    await auditLog(actor.id, "set_nextgen_legacy_rate", "guardian", guardianId, { legacyRateCents: 16500, fromFamilyPage: true });
    revalidatePath("/os/families");
    revalidatePath("/os/nextgen");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't approve the rate." };
  }
}
