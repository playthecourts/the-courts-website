import "server-only";
import { prisma } from "@/lib/prisma";

/// Call right after a new Athlete is created (signup, or "Add Athlete" later)
/// — links it to an unmatched EvalAttendanceRecord with the same first+last
/// name, if exactly one exists. Silently no-ops otherwise (no match, or more
/// than one candidate — ambiguous matches aren't auto-linked). This is the
/// "attended evals before the family had an account" path; matchExistingAthletes
/// below handles the reverse (record imported after the athlete already existed).
export async function matchEvalAttendanceForNewAthlete(
  athleteId: string,
  firstName: string,
  lastName: string
) {
  const candidates = await prisma.evalAttendanceRecord.findMany({
    where: { matchedAthleteId: null, firstName: { equals: firstName, mode: "insensitive" }, lastName: { equals: lastName, mode: "insensitive" } },
  });
  if (candidates.length !== 1) return;

  await prisma.evalAttendanceRecord.update({
    where: { id: candidates[0].id },
    data: { matchedAthleteId: athleteId, matchedAt: new Date() },
  });
}
