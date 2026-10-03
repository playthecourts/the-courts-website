"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability, assertFamilyAccess } from "@/lib/os/dal";
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

export type AddParentState = { ok?: string; error?: string } | null;

/// Staff adding a second parent (or grandparent, stepparent…) to a family —
/// the same record a parent creates from My Courts. No login is created: if
/// they sign up later with this email, the account attaches to this record.
/// An email that already belongs to a parent in the system links that person
/// instead of creating a duplicate.
export async function addParentToFamily(_prev: AddParentState, formData: FormData): Promise<AddParentState> {
  try {
    const actor = await requireCapability("families.edit");
    const familyId = String(formData.get("familyId") ?? "");
    await assertFamilyAccess(actor, familyId);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const relationship = String(formData.get("relationship") ?? "").trim() || null;
    const pickup = formData.get("pickup") === "on";
    if (!name) return { error: "Enter their name." };
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That email doesn't look right." };

    const existing = email ? await prisma.guardian.findUnique({ where: { email }, select: { id: true, name: true } }) : null;
    if (existing) {
      const linked = await prisma.familyGuardian.findUnique({ where: { familyId_guardianId: { familyId, guardianId: existing.id } } });
      if (linked) return { error: `${existing.name} is already on this family.` };
    }

    const guardianId = await prisma.$transaction(async (tx) => {
      const g = existing ?? (await tx.guardian.create({ data: { name, email, phone }, select: { id: true, name: true } }));
      await tx.familyGuardian.create({
        data: { familyId, guardianId: g.id, isPrimary: false, relationship, authorizedForPickup: pickup },
      });
      return g.id;
    });
    await auditLog(actor.id, "add_guardian", "family", familyId, { guardianId, linkedExisting: !!existing });
    revalidatePath(`/os/families/${familyId}`);
    return { ok: existing ? `${existing.name} already had an account — linked to this family.` : `${name} added.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't add that parent." };
  }
}

/// Staff correcting a parent's contact details from the Family page — name,
/// phone, relationship, and email. Email can only change for a parent who
/// hasn't signed in yet: a signed-in parent's email is their login, which
/// they change themselves.
export async function updateParentContact(_prev: AddParentState, formData: FormData): Promise<AddParentState> {
  try {
    const actor = await requireCapability("families.edit");
    const familyId = String(formData.get("familyId") ?? "");
    const guardianId = String(formData.get("guardianId") ?? "");
    await assertFamilyAccess(actor, familyId);
    const link = await prisma.familyGuardian.findUnique({
      where: { familyId_guardianId: { familyId, guardianId } },
      select: { guardian: { select: { authId: true, email: true } } },
    });
    if (!link) return { error: "That parent isn't on this family." };

    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const relationship = String(formData.get("relationship") ?? "").trim() || null;
    const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase() || null;
    if (!name) return { error: "Name can't be blank." };

    let email = link.guardian.email;
    if (!link.guardian.authId && emailRaw !== link.guardian.email) {
      if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) return { error: "That email doesn't look right." };
      if (emailRaw) {
        const taken = await prisma.guardian.findUnique({ where: { email: emailRaw }, select: { id: true } });
        if (taken && taken.id !== guardianId) return { error: "Another parent already uses that email." };
      }
      email = emailRaw;
    }

    await prisma.$transaction([
      prisma.guardian.update({ where: { id: guardianId }, data: { name, phone, email } }),
      prisma.familyGuardian.update({ where: { familyId_guardianId: { familyId, guardianId } }, data: { relationship } }),
    ]);
    await auditLog(actor.id, "edit_guardian", "family", familyId, { guardianId });
    revalidatePath(`/os/families/${familyId}`);
    return { ok: "Saved." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't save." };
  }
}
