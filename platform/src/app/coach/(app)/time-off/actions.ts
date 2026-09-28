"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentCoach } from "@/lib/coach-dal";

// CoachAvailability already existed in the schema (weekday-recurring OR a
// specific date, start/end minute, available/preferred/unavailable status)
// and was already read by findConflicts() (lib/programs/conflicts.ts) to
// warn an admin building a schedule that a coach is unavailable — but
// nothing ever wrote to it. This is that write path. One row per calendar
// day in the requested range, full-day (0-1440 minutes), status
// "unavailable" — the existing conflict-preview warning picks these up
// automatically, no changes needed there.

const MAX_RANGE_DAYS = 60;

export async function requestTimeOff(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const actor = await getCurrentCoach();

  const startStr = String(formData.get("startDate") ?? "");
  const endStr = String(formData.get("endDate") ?? startStr);
  const note = ((formData.get("note") as string) || "").trim() || null;

  const start = new Date(`${startStr}T00:00:00Z`);
  const end = new Date(`${endStr}T00:00:00Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { ok: false, error: "Pick a start and end date." };
  if (end < start) return { ok: false, error: "The end date has to be on or after the start date." };

  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (days > MAX_RANGE_DAYS) return { ok: false, error: `That's more than ${MAX_RANGE_DAYS} days — request a shorter range.` };

  const rows = Array.from({ length: days }, (_, i) => ({
    staffUserId: actor.id,
    specificDate: new Date(start.getTime() + i * 86_400_000),
    startMinute: 0,
    endMinute: 1440,
    status: "unavailable" as const,
    note,
  }));
  await prisma.coachAvailability.createMany({ data: rows });

  revalidatePath("/coach/time-off");
  return { ok: true };
}

/// Deletes every row in one requested block at once (the UI groups
/// consecutive same-note days into one visual block and passes all their
/// ids here) — a coach only ever removes their own rows.
export async function cancelTimeOff(ids: string[]) {
  const actor = await getCurrentCoach();
  await prisma.coachAvailability.deleteMany({ where: { id: { in: ids }, staffUserId: actor.id } });
  revalidatePath("/coach/time-off");
}
