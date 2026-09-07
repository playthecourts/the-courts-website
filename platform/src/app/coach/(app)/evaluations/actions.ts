"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentCoach, assertProgramAccess, assertAthleteAccess } from "@/lib/coach-dal";
import { rubricForSport } from "@/lib/coach-tags";

/**
 * Save one coach's evaluation of one athlete.
 *
 * Scores are validated against the rubric for the program's sport, so a
 * replayed request can't stuff arbitrary keys or out-of-range values into the
 * Json column. The unique constraint on (program, athlete, coach) means saving
 * twice updates rather than duplicating — a coach can revise as they watch.
 */
export async function saveEvaluation(
  programId: string,
  athleteId: string,
  scores: Record<string, number>,
  notes: string,
  recommendedLevel: string | null
) {
  const actor = await getCurrentCoach();
  await assertProgramAccess(actor, programId);
  await assertAthleteAccess(actor, athleteId);

  const program = await prisma.program.findUniqueOrThrow({
    where: { id: programId },
    select: { sport: true },
  });

  const rubric = rubricForSport(program.sport);
  const clean: Record<string, number> = {};
  for (const category of rubric) {
    const value = scores[category.key];
    if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5) {
      clean[category.key] = value;
    }
  }

  await prisma.evaluation.upsert({
    where: { programId_athleteId_staffUserId: { programId, athleteId, staffUserId: actor.id } },
    create: {
      programId,
      athleteId,
      staffUserId: actor.id,
      sport: program.sport ?? "Basketball",
      scores: clean,
      notes: notes.trim() || null,
      recommendedLevel: recommendedLevel?.trim() || null,
    },
    update: {
      scores: clean,
      notes: notes.trim() || null,
      recommendedLevel: recommendedLevel?.trim() || null,
    },
  });

  revalidatePath(`/coach/evaluations/${programId}`);
  return { ok: true as const };
}
