"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/admin-dal";
import { prisma } from "@/lib/prisma";
import { ProgramType } from "@/generated/prisma/enums";

function dollarsToCents(value: FormDataEntryValue | null): number | null {
  if (!value || value === "") return null;
  return Math.round(parseFloat(value as string) * 100);
}

export async function createProgram(_prevState: unknown, formData: FormData) {
  await getCurrentStaff();

  const program = await prisma.program.create({
    data: {
      name: formData.get("name") as string,
      programType: formData.get("programType") as ProgramType,
      sport: (formData.get("sport") as string) || null,
      description: (formData.get("description") as string) || null,
      priceCents: dollarsToCents(formData.get("price")),
      memberPriceCents: dollarsToCents(formData.get("memberPrice")),
    },
  });
  revalidatePath("/admin/programs");
  redirect(`/admin/programs/${program.id}`);
}

export async function updateProgram(programId: string, formData: FormData) {
  await getCurrentStaff();

  await prisma.program.update({
    where: { id: programId },
    data: {
      name: formData.get("name") as string,
      programType: formData.get("programType") as ProgramType,
      sport: (formData.get("sport") as string) || null,
      description: (formData.get("description") as string) || null,
      priceCents: dollarsToCents(formData.get("price")),
      memberPriceCents: dollarsToCents(formData.get("memberPrice")),
    },
  });
  revalidatePath(`/admin/programs/${programId}`);
  revalidatePath("/admin/programs");
}

// Fixed-date event: one session on an exact date/time.
// The <input type="datetime-local"> value has no timezone marker; appending
// "Z" forces it to parse as literal UTC regardless of server timezone,
// matching generateRecurringSessions below. There's no real multi-timezone
// need yet (one physical facility) — this treats wall-clock input as fixed.
export async function createSession(programId: string, formData: FormData) {
  await getCurrentStaff();

  const startTime = new Date(`${formData.get("startTime") as string}Z`);
  const durationMinutes = parseInt(formData.get("durationMinutes") as string, 10);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);
  const teamId = (formData.get("teamId") as string) || null;

  await prisma.session.create({
    data: {
      programId,
      teamId,
      startTime,
      endTime,
      capacity: parseInt(formData.get("capacity") as string, 10),
    },
  });
  revalidatePath(`/admin/programs/${programId}`);
  revalidatePath("/admin/schedule");
}

// Recurring class: bulk-generates one Session row per week for N weeks,
// on a given day of week + time. Materialized rows, not an expanded rule.
export async function generateRecurringSessions(programId: string, formData: FormData) {
  await getCurrentStaff();

  const startDate = new Date(formData.get("startDate") as string);
  const dayOfWeek = parseInt(formData.get("dayOfWeek") as string, 10);
  const [hour, minute] = (formData.get("time") as string).split(":").map(Number);
  const durationMinutes = parseInt(formData.get("durationMinutes") as string, 10);
  const weeks = parseInt(formData.get("weeks") as string, 10);
  const capacity = parseInt(formData.get("capacity") as string, 10);
  const teamId = (formData.get("teamId") as string) || null;

  // Find the first occurrence on/after startDate matching dayOfWeek.
  const first = new Date(startDate);
  const daysUntil = (dayOfWeek - first.getUTCDay() + 7) % 7;
  first.setUTCDate(first.getUTCDate() + daysUntil);
  first.setUTCHours(hour, minute, 0, 0);

  const sessions = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(first);
    start.setUTCDate(start.getUTCDate() + i * 7);
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    return { programId, teamId, startTime: start, endTime: end, capacity };
  });

  await prisma.session.createMany({ data: sessions });
  revalidatePath(`/admin/programs/${programId}`);
  revalidatePath("/admin/schedule");
}

export async function cancelSession(sessionId: string, programId: string) {
  await getCurrentStaff();
  await prisma.session.update({ where: { id: sessionId }, data: { status: "cancelled" } });
  revalidatePath(`/admin/programs/${programId}`);
  revalidatePath("/admin/schedule");
}

export async function deleteSession(sessionId: string, programId: string) {
  await getCurrentStaff();
  await prisma.session.delete({ where: { id: sessionId } });
  revalidatePath(`/admin/programs/${programId}`);
  revalidatePath("/admin/schedule");
}
