"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";

export async function createFamily(_prevState: unknown, formData: FormData) {
  await getCurrentStaff();
  const name = formData.get("name") as string;

  const family = await prisma.family.create({ data: { name } });
  revalidatePath("/admin/families");
  redirect(`/admin/families/${family.id}`);
}

export async function updateFamilyName(familyId: string, formData: FormData) {
  await getCurrentStaff();
  const name = formData.get("name") as string;

  await prisma.family.update({ where: { id: familyId }, data: { name } });
  revalidatePath(`/admin/families/${familyId}`);
  revalidatePath("/admin/families");
}

export async function createAthlete(familyId: string, formData: FormData) {
  await getCurrentStaff();

  await prisma.athlete.create({
    data: {
      familyId,
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      dob: new Date(formData.get("dob") as string),
      grade: (formData.get("grade") as string) || null,
      gender: (formData.get("gender") as string) || null,
    },
  });
  revalidatePath(`/admin/families/${familyId}`);
  revalidatePath("/admin/athletes");
}

export async function updateAthlete(athleteId: string, formData: FormData) {
  await getCurrentStaff();

  const athlete = await prisma.athlete.update({
    where: { id: athleteId },
    data: {
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      dob: new Date(formData.get("dob") as string),
      grade: (formData.get("grade") as string) || null,
      gender: (formData.get("gender") as string) || null,
    },
  });
  revalidatePath(`/admin/families/${athlete.familyId}`);
  revalidatePath("/admin/athletes");
}

export async function deleteAthlete(athleteId: string, familyId: string) {
  await getCurrentStaff();
  await prisma.athlete.delete({ where: { id: athleteId } });
  revalidatePath(`/admin/families/${familyId}`);
  revalidatePath("/admin/athletes");
}

/// Reverses the parent-facing "Archive" action (my-courts/athletes/actions.ts)
/// — a family that archived the wrong kid, or wants one back, gets restored
/// with everything intact since archiving never deleted anything. Staff can
/// also archive directly from here; unlike the parent-facing action this has
/// no active-membership block, since staff may have a real reason to archive
/// alongside a membership they're separately handling in Stripe.
export async function setAthleteArchived(athleteId: string, familyId: string, archived: boolean) {
  await getCurrentStaff();
  await prisma.athlete.update({ where: { id: athleteId }, data: { archivedAt: archived ? new Date() : null } });
  revalidatePath(`/admin/families/${familyId}`);
  revalidatePath("/admin/athletes");
}
