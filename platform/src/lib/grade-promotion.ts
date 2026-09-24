import "server-only";
import { prisma } from "@/lib/prisma";

// Grade is free text (Athlete.grade), entered once by a parent or staff
// member and never advanced on its own — unlike age, which is always
// computed live from dob (see athlete.ts's ageFrom). This runs once a year,
// right after the school year ends, to promote every athlete one grade and
// normalize the format at the same time (real data has "8th", "7", "3rd",
// "Pre K" all coexisting today).

const ORDINALS = [
  "K", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th",
];

/// Parses a grade string into a level (0 = Kindergarten, 1-12 = that grade).
/// Returns null when the value doesn't look like a real grade — those
/// athletes are skipped and reported rather than guessed at.
export function parseGradeLevel(raw: string): number | null {
  const value = raw.trim().toLowerCase();
  if (value === "k" || value === "kindergarten" || value.replace(/[\s-]/g, "") === "prek") {
    return 0;
  }
  const match = value.match(/^(\d{1,2})/);
  if (!match) return null;
  const level = Number(match[1]);
  if (!Number.isInteger(level) || level < 0 || level > 12) return null;
  return level;
}

export function formatGradeLevel(level: number): string {
  return ORDINALS[level] ?? String(level);
}

export type PromotionResult = {
  promoted: { athleteId: string; name: string; from: string; to: string }[];
  keptAt12th: { athleteId: string; name: string }[];
  unparsed: { athleteId: string; name: string; grade: string }[];
};

/// Never invents "13th" — an athlete already at 12th grade is left exactly
/// as-is (per the business decision this year), not archived or advanced.
export async function promoteAllGrades(): Promise<PromotionResult> {
  const athletes = await prisma.athlete.findMany({
    where: { grade: { not: null } },
    select: { id: true, firstName: true, lastName: true, grade: true },
  });

  const result: PromotionResult = { promoted: [], keptAt12th: [], unparsed: [] };

  for (const athlete of athletes) {
    const grade = athlete.grade!;
    const name = `${athlete.firstName} ${athlete.lastName}`;
    const level = parseGradeLevel(grade);

    if (level === null) {
      result.unparsed.push({ athleteId: athlete.id, name, grade });
      continue;
    }
    if (level >= 12) {
      result.keptAt12th.push({ athleteId: athlete.id, name });
      continue;
    }

    const nextGrade = formatGradeLevel(level + 1);
    await prisma.athlete.update({ where: { id: athlete.id }, data: { grade: nextGrade } });
    result.promoted.push({ athleteId: athlete.id, name, from: grade, to: nextGrade });
  }

  return result;
}
