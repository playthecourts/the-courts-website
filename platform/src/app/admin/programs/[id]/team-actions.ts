"use server";

import { revalidatePath } from "next/cache";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";

export async function createTeam(programId: string, formData: FormData) {
  await getCurrentStaff();

  await prisma.team.create({
    data: {
      programId,
      name: formData.get("name") as string,
      division: (formData.get("division") as string) || null,
    },
  });
  revalidatePath(`/admin/programs/${programId}`);
}

export async function deleteTeam(teamId: string, programId: string) {
  await getCurrentStaff();
  await prisma.team.delete({ where: { id: teamId } });
  revalidatePath(`/admin/programs/${programId}`);
}

export async function addTeamMember(teamId: string, programId: string, formData: FormData) {
  await getCurrentStaff();

  const athleteId = formData.get("athleteId") as string;
  await prisma.teamMember.upsert({
    where: { teamId_athleteId: { teamId, athleteId } },
    create: { teamId, athleteId },
    update: {},
  });
  revalidatePath(`/admin/programs/${programId}`);
}

export async function removeTeamMember(teamId: string, athleteId: string, programId: string) {
  await getCurrentStaff();
  await prisma.teamMember.delete({ where: { teamId_athleteId: { teamId, athleteId } } });
  revalidatePath(`/admin/programs/${programId}`);
}
