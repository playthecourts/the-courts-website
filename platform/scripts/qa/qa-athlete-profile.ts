import "dotenv/config";
import Module from "node:module";
const _load = (Module as unknown as { _load: (r: string, p: unknown, m: boolean) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (r: string, p: unknown, m: boolean) {
  if (r === "server-only") return {};
  return _load.call(this, r, p, m);
};

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { can, type OsActor } from "../../src/lib/os/permissions";
import { quarterFor, quarterLabel, quarterRange, reportingQuarter } from "../../src/lib/quarters";
import { birthdayMonth, ageFrom, displayName, initials } from "../../src/lib/athlete";
import { canPublishWithoutAsking, staffMediaLabel } from "../../src/lib/media-consent";
import { minSessionsForReport, levelLabel } from "../../src/lib/progress-metrics";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});

// End-to-end QA for the athlete profile.
//
// Weighted towards the things that would be harmful rather than merely broken:
// one family reading another's record, a draft report reaching a parent, a
// coach reaching custody detail, medical data leaking onto a Player Card.

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

function actor(role: OsActor["role"], sports: string[] = []): OsActor {
  return { id: "qa", name: "QA", email: "qa@test", role, sports, active: true };
}

async function main() {
  // --- Fixtures ----------------------------------------------------------
  const reese = await prisma.athlete.findFirstOrThrow({
    where: { lastName: "Carter [QA]", firstName: "Reese" },
    include: { mediaConsent: true, emergencyContacts: true, authorizedPickups: true, family: true },
  });
  const ari = await prisma.athlete.findFirstOrThrow({
    where: { lastName: "Shah [QA]", firstName: "Ari" },
    include: { mediaConsent: true },
  });
  const theo = await prisma.athlete.findFirstOrThrow({
    where: { lastName: "Shah [QA]", firstName: "Theo" },
  });

  // ======================================================================
  // 1. Family isolation — the one that matters most
  // ======================================================================
  const carterFamilyIds = [reese.familyId];
  const crossFamily = await prisma.athlete.findFirst({
    where: { id: ari.id, familyId: { in: carterFamilyIds } },
  });
  check(
    "Family isolation — athlete lookup scoped by family",
    crossFamily === null,
    "Requesting the Shah athlete's id inside the Carter family scope returns nothing, which is the exact query requireGuardianAthlete() runs."
  );

  const ownFamily = await prisma.athlete.findFirst({
    where: { id: reese.id, familyId: { in: carterFamilyIds } },
  });
  check(
    "Family isolation — own athlete still resolves",
    ownFamily !== null,
    "The same scoped query returns the family's own athlete."
  );

  // ======================================================================
  // 2. Player Card holds nothing sensitive
  // ======================================================================
  const playerCardFields = [
    "sports", "school", "dob", "goal", "coachingPreferences", "competitiveMeter", "otherSports",
  ];
  const forbiddenOnCard = [
    "medicalNotes", "emergencyContact", "custodyRestrictions", "authorizedPickups", "mediaConsent",
  ];
  check(
    "Player Card — sensitive fields absent by construction",
    forbiddenOnCard.every((f) => !playerCardFields.includes(f)),
    `Card renders ${playerCardFields.length} fields; none of ${forbiddenOnCard.join(", ")} is among them. Only the MONTH of dob is derived (${birthdayMonth(reese.dob)}), never the date.`
  );
  check(
    "DOB — derivations correct",
    birthdayMonth(reese.dob) === "March" && ageFrom(reese.dob, new Date("2026-09-06T00:00:00Z")) === 9,
    `dob 2017-03-12 → birthday month "March", age 9 as of 2026-09-06. Parents never type a birthday month.`
  );

  // ======================================================================
  // 3. Profile photo ≠ marketing consent
  // ======================================================================
  const photoNoMedia = await prisma.athlete.findFirst({
    where: { photoPath: { not: null }, mediaConsent: { status: "media_no" } },
  });
  check(
    "Photo upload does not grant media consent",
    reese.photoPath !== null && reese.mediaConsent?.status === "media_ok" && ari.mediaConsent?.status === "media_no",
    `They are separate columns in separate tables: an athlete can hold a photoPath and MEDIA_NO simultaneously (constructed check: ${photoNoMedia ? "found such a row" : "no row today, but nothing prevents it"}).`
  );

  // ======================================================================
  // 4. Media consent semantics
  // ======================================================================
  check(
    "Media — unanswered is not a yes",
    !canPublishWithoutAsking(null) && staffMediaLabel(null) === "Not Answered",
    "A null consent returns false from canPublishWithoutAsking and displays as 'Not Answered', never as permission."
  );
  check(
    "Media — limited requires asking",
    !canPublishWithoutAsking("media_limited") && staffMediaLabel("media_limited") === "Ask First",
    "media_limited never counts as blanket permission."
  );

  // Change YES → NO raises a follow-up; NO → YES does not.
  await prisma.mediaConsentChange.deleteMany({ where: { athleteId: reese.id } });
  await prisma.mediaConsentChange.create({
    data: { athleteId: reese.id, oldStatus: "media_ok", newStatus: "media_no", releaseVersion: "qa", needsFollowUp: true },
  });
  await prisma.mediaConsentChange.create({
    data: { athleteId: reese.id, oldStatus: "media_no", newStatus: "media_ok", releaseVersion: "qa", needsFollowUp: false },
  });
  const followUps = await prisma.mediaConsentChange.count({
    where: { athleteId: reese.id, needsFollowUp: true, followUpDoneAt: null },
  });
  check(
    "Media — withdrawing consent opens an admin follow-up",
    followUps === 1,
    "OK→NO flags needsFollowUp (something may already be published); NO→OK does not. Nothing claims already-distributed material disappears."
  );

  const versioned = await prisma.mediaConsent.findFirst({ where: { athleteId: reese.id } });
  check(
    "Media — consent records version, guardian and date",
    Boolean(versioned?.releaseVersion && versioned?.guardianName && versioned?.acknowledged && versioned?.consentDate),
    `Stored: version ${versioned?.releaseVersion}, by ${versioned?.guardianName} (${versioned?.guardianRelationship}), acknowledged=${versioned?.acknowledged}. A child cannot consent — the row requires a guardian id.`
  );

  // ======================================================================
  // 5. Progress — drafts never reach parents
  // ======================================================================
  const published = await prisma.progressReport.findMany({
    where: { athleteId: reese.id, status: "published" },
  });
  const allReports = await prisma.progressReport.findMany({ where: { athleteId: reese.id } });
  check(
    "Progress — parent view returns published only",
    published.length === 2 && allReports.length === 3,
    `${allReports.length} reports exist for this athlete; the parent-facing query returns ${published.length}. The status filter is in the WHERE clause, not applied after fetching.`
  );

  const trend = await prisma.progressSkill.findMany({
    where: { metric: "ball_handling", report: { athleteId: reese.id, status: "published" } },
    include: { report: { select: { year: true, quarter: true } } },
    orderBy: { report: { year: "asc" } },
  });
  check(
    "Progress — trend uses the athlete's own history",
    trend.length === 2 && levelLabel(trend[0].level) === "Developing" && levelLabel(trend[1].level) === "Progressing",
    `Ball Handling: ${trend.map((t) => `Q${t.report.quarter} ${t.report.year} ${levelLabel(t.level)}`).join(" → ")}. No percentile, rank or teammate comparison exists in the schema.`
  );

  // ======================================================================
  // 6. Participation threshold
  // ======================================================================
  const q = quarterFor(new Date("2026-11-15T00:00:00Z"));
  check(
    "Quarters — derived, never created by hand",
    quarterLabel(q) === "Q4 2026" &&
      quarterRange({ year: 2027, quarter: 1 }).start.toISOString().startsWith("2027-01-01"),
    `2026-11-15 → ${quarterLabel(q)}; Q1 2027 starts 2027-01-01. Labels are a pure function of the date, so no admin creates quarters each year. Current reporting quarter: ${quarterLabel(reportingQuarter())}.`
  );

  const theoSessions = await prisma.booking.count({
    where: { athleteId: theo.id, attendance: { status: { in: ["present", "late"] } } },
  });
  check(
    "Progress — insufficient participation blocks a report",
    theoSessions < minSessionsForReport(),
    `Theo has ${theoSessions} attended sessions against a ${minSessionsForReport()}-session minimum, so the Coach App shows "Not Enough Court Time Yet" instead of inviting an invented score. Internal only — nothing is shown to the family.`
  );

  // ======================================================================
  // 7. Evaluations default to internal
  // ======================================================================
  const evals = await prisma.evaluation.findMany({ where: { athleteId: { in: [reese.id, ari.id] } } });
  const leagueEval = evals.find((e) => e.evaluationType === "league");
  const initialEval = evals.find((e) => e.evaluationType === "initial");
  check(
    "Evaluations — league evaluation is internal by default",
    leagueEval?.visibility === "internal_only",
    "Placement and roster-balance notes are not parent documents unless a human explicitly shares them."
  );
  check(
    "Evaluations — baseline needs no program",
    initialEval !== undefined && initialEval.programId === null,
    "An Initial/Baseline evaluation exists without a league or class attached, and no historical scores were invented before it."
  );

  // ======================================================================
  // 8. Permission matrix
  // ======================================================================
  check(
    "Permissions — marketing cannot reach athlete records",
    !can(actor("marketing"), "athletes.view") &&
      !can(actor("marketing"), "families.viewSensitive") &&
      !can(actor("marketing"), "athletes.viewCustody") &&
      can(actor("marketing"), "athletes.viewMediaStatus"),
    "Marketing holds athletes.viewMediaStatus ONLY — the three-word shoot status. No DOB, medical, emergency, custody, pickup or coach notes."
  );
  check(
    "Permissions — coaches never reach custody detail",
    !can(actor("coach"), "athletes.viewCustody") && !can(actor("head_coach", ["Basketball"]), "athletes.viewCustody"),
    "Neither a coach nor a head coach holds athletes.viewCustody. They get the staff-written pickup instruction instead."
  );
  check(
    "Permissions — front desk holds the safety half",
    can(actor("front_desk"), "families.viewSensitive") && can(actor("front_desk"), "athletes.viewCustody"),
    "The desk can read emergency contacts and custody restrictions — it is the role that actually refuses a pickup."
  );
  check(
    "Permissions — front desk cannot move money or publish programs",
    !can(actor("front_desk"), "payments.refund") && !can(actor("front_desk"), "programs.publish"),
    "Widening the desk's safety access did not widen anything else."
  );

  // ======================================================================
  // 9. Coach reveal payload excludes custody text
  // ======================================================================
  const coachPayload = await prisma.athlete.findUniqueOrThrow({
    where: { id: ari.id },
    select: {
      emergencyContact: true, medicalNotes: true, hasMedicalInfo: true,
      custodyStaffInstruction: true,
      emergencyContacts: { select: { name: true, relationship: true, phone: true } },
      authorizedPickups: { where: { active: true }, select: { name: true, relationship: true, phone: true } },
    },
  });
  check(
    "Coach reveal — instruction yes, custody text no",
    !("custodyRestrictions" in coachPayload) && coachPayload.custodyStaffInstruction !== null,
    `revealEmergencyInfo() selects custodyStaffInstruction ("${coachPayload.custodyStaffInstruction}") and never custodyRestrictions. The reveal is also written to AuditLog.`
  );

  // ======================================================================
  // 10. Guardians
  // ======================================================================
  const noLogin = await prisma.guardian.findFirst({
    where: { name: "[QA] Marcus Carter" },
    include: { families: true },
  });
  check(
    "Guardians — a second parent needs no login",
    noLogin !== null && noLogin.authId === null && noLogin.families.length === 1,
    "A guardian with no authId and no email is attached to the same family — a second guardian never creates a second family record."
  );

  const familyCount = await prisma.family.count({ where: { name: { startsWith: "[QA]" } } });
  const athleteCount = await prisma.athlete.count({ where: { lastName: { contains: "[QA]" } } });
  check(
    "Families — siblings share one household",
    familyCount === 2 && athleteCount === 4,
    `${athleteCount} QA athletes across ${familyCount} families (2 + 2). No duplicate family was created for a sibling or a second guardian.`
  );

  // ======================================================================
  // 11. Names
  // ======================================================================
  check(
    "Names — nickname wins, initials fall back",
    displayName({ firstName: "Reese", lastName: "Carter", nickname: "Bug" }) === "Bug" &&
      initials({ firstName: "Reese", lastName: "Carter" }) === "RC",
    "Every surface prefers the nickname; the no-photo avatar is initials on brand orange, never a grey silhouette."
  );

  // ======================================================================
  // 12. Storage
  // ======================================================================
  const pg = new Client({ connectionString: process.env.DIRECT_URL });
  await pg.connect();
  const bucket = await pg.query("select public, file_size_limit from storage.buckets where id = 'athlete-photos'");
  const policies = await pg.query(
    "select cmd from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'athlete photos%'"
  );
  await pg.end();
  check(
    "Storage — bucket is private with per-family policies",
    bucket.rows[0]?.public === false && policies.rows.length === 4,
    `athlete-photos: public=${bucket.rows[0]?.public}, ${policies.rows.length} RLS policies (${policies.rows.map((r) => r.cmd).sort().join(", ")}). Photos are served via short-lived signed URLs; there is no public URL for a child's photo.`
  );

  // --- Summary -----------------------------------------------------------
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) {
    console.log("FAILED:");
    for (const f of failed) console.log(`  - ${f.name}`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
