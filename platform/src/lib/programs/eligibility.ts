import "server-only";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Who may register, and what a family sees.
//
// One decision function, read by the Parent App, the website feed and the admin
// registration screen, so a parent can never be shown a program they cannot
// book and an admin can never be told a different answer than the parent got.
// ---------------------------------------------------------------------------

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: string; /// Safe to show a parent verbatim.
      parentFacing: boolean };

export type AthleteForEligibility = {
  id: string;
  grade: string | null;
  dob: Date;
  gender: string | null;
};

export type OfferingEligibilityRules = {
  gradeMin: number | null;
  gradeMax: number | null;
  ageMin: number | null;
  ageMax: number | null;
  gender: string | null;
  inviteOnly: boolean;
  requiresTrainingPlan: boolean;
};

/// Athlete.grade is free text ("3rd", "3", "3rd Grade", "K"). Parse it to the
/// same integer scale the offering's range uses, tolerantly — a grade we can't
/// parse must not silently exclude a child from everything.
export function parseGrade(grade: string | null): number | null {
  if (!grade) return null;
  const g = grade.trim().toLowerCase();
  if (g === "k" || g.startsWith("kinder")) return 0;
  const m = g.match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return n >= 0 && n <= 12 ? n : null;
}

export function ageOn(dob: Date, on: Date): number {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < dob.getUTCMonth() ||
    (on.getUTCMonth() === dob.getUTCMonth() && on.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age--;
  return age;
}

/// Pure rules check. Training-plan and invite gates need database context and
/// are layered on by checkEligibility below.
export function checkAgeAndGrade(
  athlete: AthleteForEligibility,
  rules: OfferingEligibilityRules,
  on: Date
): EligibilityResult {
  const grade = parseGrade(athlete.grade);

  if (rules.gradeMin !== null || rules.gradeMax !== null) {
    // An unknown grade is not a rejection — it's missing data. Say so, so the
    // family can fix it, instead of pretending the program doesn't apply.
    if (grade === null) {
      return {
        eligible: false,
        reason: "Add this athlete's grade to check eligibility.",
        parentFacing: true,
      };
    }
    if (rules.gradeMin !== null && grade < rules.gradeMin) {
      return { eligible: false, reason: "This is for older grades.", parentFacing: true };
    }
    if (rules.gradeMax !== null && grade > rules.gradeMax) {
      return { eligible: false, reason: "This is for younger grades.", parentFacing: true };
    }
  }

  if (rules.ageMin !== null || rules.ageMax !== null) {
    const age = ageOn(athlete.dob, on);
    if (rules.ageMin !== null && age < rules.ageMin) {
      return { eligible: false, reason: `For ages ${rules.ageMin}+.`, parentFacing: true };
    }
    if (rules.ageMax !== null && age > rules.ageMax) {
      return { eligible: false, reason: `For ages up to ${rules.ageMax}.`, parentFacing: true };
    }
  }

  // Only applied when the offering genuinely restricts by gender, and compared
  // loosely because both sides are free text.
  if (rules.gender && rules.gender.toLowerCase() !== "any" && athlete.gender) {
    const want = rules.gender.toLowerCase();
    const has = athlete.gender.toLowerCase();
    const matches =
      want === has ||
      (want.startsWith("boy") && (has.startsWith("boy") || has.startsWith("m"))) ||
      (want.startsWith("girl") && (has.startsWith("girl") || has.startsWith("f")));
    if (!matches) {
      return { eligible: false, reason: `This is a ${rules.gender} program.`, parentFacing: true };
    }
  }

  return { eligible: true };
}

/// Full check, including the gates that need the database.
export async function checkEligibility(
  athleteId: string,
  offeringId: string,
  on: Date = new Date()
): Promise<EligibilityResult> {
  const [athlete, offering] = await Promise.all([
    prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { id: true, grade: true, dob: true, gender: true },
    }),
    prisma.offering.findUnique({
      where: { id: offeringId },
      select: {
        gradeMin: true,
        gradeMax: true,
        ageMin: true,
        ageMax: true,
        gender: true,
        inviteOnly: true,
        requiresTrainingPlan: true,
      },
    }),
  ]);
  if (!athlete || !offering) {
    return { eligible: false, reason: "Not found.", parentFacing: false };
  }

  const base = checkAgeAndGrade(athlete, offering, on);
  if (!base.eligible) return base;

  if (offering.requiresTrainingPlan) {
    const active = await prisma.athleteMembership.count({
      where: { athleteId, status: "active" },
    });
    if (active === 0) {
      return {
        eligible: false,
        reason: "A Training Plan is required for this program.",
        parentFacing: true,
      };
    }
  }

  if (offering.inviteOnly) {
    // Invitation is expressed as an admin-created registration the family then
    // completes — there is no separate invite table to drift out of sync.
    const invited = await prisma.registration.count({
      where: { offeringId, athleteId, status: { in: ["started", "incomplete", "registered"] } },
    });
    if (invited === 0) {
      return { eligible: false, reason: "This program is invitation only.", parentFacing: true };
    }
  }

  return { eligible: true };
}
