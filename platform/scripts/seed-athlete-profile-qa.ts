import "dotenv/config";
import Module from "node:module";
const _load = (Module as unknown as { _load: (r: string, p: unknown, m: boolean) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (r: string, p: unknown, m: boolean) {
  if (r === "server-only") return {};
  return _load.call(this, r, p, m);
};

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});

// ---------------------------------------------------------------------------
// QA fixtures for the athlete profile — the 24 scenarios from the brief.
//
// Every record created here is fictional and prefixed [QA] so it can be found
// and removed without touching a real family. No real child's data is used for
// testing, and --clean removes everything this script made.
//
//   npm run seed:athlete-qa
//   npm run seed:athlete-qa -- --clean
// ---------------------------------------------------------------------------

const TAG = "[QA]";
const clean = process.argv.includes("--clean");

async function wipe() {
  const families = await prisma.family.findMany({
    where: { name: { startsWith: TAG } },
    select: { id: true },
  });
  const familyIds = families.map((f) => f.id);

  if (familyIds.length > 0) {
    // Athlete children cascade from Athlete; Athlete cascades from Family.
    await prisma.family.deleteMany({ where: { id: { in: familyIds } } });
  }
  await prisma.guardian.deleteMany({ where: { name: { startsWith: TAG } } });
  console.log(`Removed ${familyIds.length} QA families and their athletes.`);
}

async function main() {
  await wipe();
  if (clean) return;

  const staff = await prisma.staffUser.findFirst({ where: { active: true } });
  if (!staff) throw new Error("No active staff user — seed one before running QA fixtures.");

  const dob = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

  // --- Family 1: two siblings, two guardians (scenarios 7, 8) --------------
  const momCarter = await prisma.guardian.create({
    data: { name: `${TAG} Dana Carter`, email: `qa-dana@example.test`, phone: "615-555-0101" },
  });
  const dadCarter = await prisma.guardian.create({
    // No authId and no email: a second parent entered by the first, with no
    // login of their own. Scenario for the "guardian without an account" path.
    data: { name: `${TAG} Marcus Carter`, phone: "615-555-0102" },
  });

  const carters = await prisma.family.create({
    data: {
      name: `${TAG} Carter Family`,
      guardians: {
        create: [
          {
            guardianId: momCarter.id,
            isPrimary: true,
            relationship: "Mom",
            authorizedForPickup: true,
            livesWithAthlete: true,
          },
          {
            guardianId: dadCarter.id,
            relationship: "Dad",
            authorizedForPickup: true,
            livesWithAthlete: true,
          },
        ],
      },
    },
  });

  // 1, 4, 5, 12, 13, 15, 16 — complete basketball athlete, nickname, photo,
  // medical info, pickup person, parent note, MEDIA OK.
  const rhys = await prisma.athlete.create({
    data: {
      familyId: carters.id,
      firstName: "Reese",
      lastName: `Carter ${TAG}`,
      nickname: "Reese",
      dob: dob(2017, 3, 12),
      grade: "3rd",
      school: "Sample Elementary",
      sports: ["Basketball"],
      // A path that intentionally has no object behind it: the UI must fall
      // back to the initials avatar rather than break on a missing file.
      photoPath: `athletes/qa-placeholder/none.jpg`,
      goal: "Finishing with my left hand",
      coachingPreferences: ["challenge_me", "lots_of_reps"],
      competitiveMeter: "keep_score",
      otherSports: ["Soccer"],
      parentCoachNote: "Gets quiet when corrected in front of the group — a word aside works better.",
      hasMedicalInfo: true,
      medicalNotes: "Peanut allergy. Carries an EpiPen in his bag.",
      basicsCompletedAt: new Date(),
      emergencyContacts: {
        create: [
          // 10 — same as a parent, linked back to the guardian row.
          { name: `${TAG} Dana Carter`, relationship: "Mom", phone: "615-555-0101", guardianId: momCarter.id },
        ],
      },
      authorizedPickups: {
        create: [
          { name: `${TAG} Ruth Carter`, relationship: "Grandmother", phone: "615-555-0103", note: "Camp weeks only" },
        ],
      },
      mediaConsent: {
        create: {
          status: "media_ok",
          consentedByGuardianId: momCarter.id,
          guardianName: `${TAG} Dana Carter`,
          guardianRelationship: "Mom",
          acknowledged: true,
          consentDate: new Date(),
          releaseVersion: "2026-09-draft-1",
        },
      },
    },
  });

  // 2, 6, 11, 17 — volleyball athlete, no photo, separate emergency contact,
  // MEDIA LIMITED.
  const sibling = await prisma.athlete.create({
    data: {
      familyId: carters.id,
      firstName: "Nora",
      lastName: `Carter ${TAG}`,
      dob: dob(2014, 8, 2),
      grade: "6th",
      sports: ["Volleyball"],
      goal: "More consistent serving",
      coachingPreferences: ["show_me_first", "encourage_me"],
      competitiveMeter: "likes_a_challenge",
      basicsCompletedAt: new Date(),
      emergencyContacts: {
        create: [{ name: `${TAG} Alice Nguyen`, relationship: "Aunt", phone: "615-555-0110" }],
      },
      mediaConsent: {
        create: {
          status: "media_limited",
          consentedByGuardianId: momCarter.id,
          guardianName: `${TAG} Dana Carter`,
          guardianRelationship: "Mom",
          acknowledged: true,
          consentDate: new Date(),
          releaseVersion: "2026-09-draft-1",
        },
      },
    },
  });

  // --- Family 2: single guardian, custody restriction, MEDIA NO ------------
  // Scenarios 3, 9, 14, 18.
  const singleParent = await prisma.guardian.create({
    data: { name: `${TAG} Priya Shah`, email: "qa-priya@example.test", phone: "615-555-0120" },
  });
  const shahFamily = await prisma.family.create({
    data: {
      name: `${TAG} Shah Family`,
      guardians: {
        create: [
          { guardianId: singleParent.id, isPrimary: true, relationship: "Mom", authorizedForPickup: true },
        ],
      },
    },
  });

  const bothSports = await prisma.athlete.create({
    data: {
      familyId: shahFamily.id,
      firstName: "Ari",
      lastName: `Shah ${TAG}`,
      dob: dob(2015, 11, 30),
      grade: "5th",
      sports: ["Basketball", "Volleyball"],
      favoriteSport: "Volleyball",
      goal: "Playing under control",
      coachingPreferences: ["tell_me_what_to_fix"],
      competitiveMeter: "here_to_learn",
      basicsCompletedAt: new Date(),
      hasCustodyRestrictions: true,
      custodyRestrictions:
        "QA fixture — fictional. Athlete may only be collected by the listed guardian.",
      custodyStaffInstruction: "Do not release athlete to an unauthorized adult.",
      emergencyContacts: {
        create: [{ name: `${TAG} Priya Shah`, relationship: "Mom", phone: "615-555-0120", guardianId: singleParent.id }],
      },
      mediaConsent: {
        create: {
          status: "media_no",
          consentedByGuardianId: singleParent.id,
          guardianName: `${TAG} Priya Shah`,
          guardianRelationship: "Mom",
          acknowledged: true,
          consentDate: new Date(),
          releaseVersion: "2026-09-draft-1",
        },
      },
    },
  });

  // 24 — an athlete with almost no history, for the insufficient-participation
  // state. No media answer either, which is its own display case.
  const newcomer = await prisma.athlete.create({
    data: {
      familyId: shahFamily.id,
      firstName: "Theo",
      lastName: `Shah ${TAG}`,
      dob: dob(2018, 5, 19),
      grade: "1st",
      sports: ["Basketball"],
      basicsCompletedAt: new Date(),
    },
  });

  // --- 19, 20: progress reports across quarters ---------------------------
  const quarters = [
    { year: 2026, quarter: 4, status: "published" as const, ball: 2, shoot: 2 },
    { year: 2027, quarter: 1, status: "published" as const, ball: 3, shoot: 3 },
    { year: 2027, quarter: 2, status: "ready_for_review" as const, ball: 4, shoot: 3 },
  ];

  for (const q of quarters) {
    await prisma.progressReport.create({
      data: {
        athleteId: rhys.id,
        sport: "Basketball",
        year: q.year,
        quarter: q.quarter,
        status: q.status,
        publishedAt: q.status === "published" ? new Date() : null,
        coachTake:
          q.quarter === 4
            ? "Reese is starting to attack off the dribble instead of waiting for the pass."
            : "Much more confident going left in live play this quarter.",
        upNextFocus: "Left-hand finishing + footwork",
        upNextProgramType: "3rd–5th Basketball Group Training",
        authorStaffId: staff.id,
        participation:
          q.status === "published"
            ? { "Group Training Sessions": 11, "Private Sessions": 2, Camp: 1 }
            : undefined,
        skills: {
          create: [
            { metric: "ball_handling", level: q.ball, clicking: true, sortOrder: 0 },
            { metric: "shooting", level: q.shoot, sortOrder: 1 },
            { metric: "confidence", level: 4, clicking: true, sortOrder: 2 },
          ],
        },
        priorities: {
          create: [
            { label: "Finishing with left hand", sortOrder: 0 },
            { label: "Defensive footwork", sortOrder: 1 },
          ],
        },
      },
    });
  }

  // A draft for the volleyball sibling — the "in progress" bucket.
  await prisma.progressReport.create({
    data: {
      athleteId: sibling.id,
      sport: "Volleyball",
      year: 2027,
      quarter: 2,
      status: "draft",
      authorStaffId: staff.id,
      skills: { create: [{ metric: "serving", level: 3, clicking: true, sortOrder: 0 }] },
    },
  });

  // --- 21, 22, 23: evaluations -------------------------------------------
  const leagueProgram = await prisma.program.findFirst({ where: { programType: "league" } });

  await prisma.evaluation.create({
    data: {
      athleteId: rhys.id,
      staffUserId: staff.id,
      sport: "Basketball",
      evaluationType: "initial",
      visibility: "internal_only",
      // No program: a baseline isn't tied to a league or class.
      scores: { ball_handling: 2, shooting: 2 },
      notes: "Baseline at intake. QA fixture.",
    },
  });

  if (leagueProgram) {
    await prisma.evaluation.create({
      data: {
        athleteId: bothSports.id,
        programId: leagueProgram.id,
        staffUserId: staff.id,
        sport: leagueProgram.sport ?? "Basketball",
        evaluationType: "league",
        // Internal by default — placement talk is never a parent document.
        visibility: "internal_only",
        scores: { overall: 3 },
        notes: "QA fixture — team balance notes, internal only.",
        recommendedLevel: "Division B",
      },
    });
  }

  await prisma.evaluation.create({
    data: {
      athleteId: sibling.id,
      staffUserId: staff.id,
      sport: "Volleyball",
      evaluationType: "skills",
      visibility: "share_with_parent",
      publishedAt: new Date(),
      scores: { serving: 3, passing: 3 },
      notes: "QA fixture — shared with parent.",
    },
  });

  console.log(
    JSON.stringify(
      {
        families: 2,
        athletes: [rhys.firstName, sibling.firstName, bothSports.firstName, newcomer.firstName],
        guardians: 3,
        progressReports: 4,
        evaluations: leagueProgram ? 3 : 2,
      },
      null,
      2
    )
  );
  console.log("\nQA fixtures seeded. Remove with: npm run seed:athlete-qa -- --clean");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
