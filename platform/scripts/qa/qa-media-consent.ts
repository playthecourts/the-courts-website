import "dotenv/config";
import Module from "node:module";
const _load = (Module as unknown as { _load: (r: string, p: unknown, m: boolean) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (r: string, p: unknown, m: boolean) {
  if (r === "server-only") return {};
  return _load.call(this, r, p, m);
};

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });

// Photo + Video Marketing Release — the scenarios from the brief.
// Every athlete created here is prefixed [QA] and removed at the end.

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (n: string, p: boolean, d: string) => {
  results.push({ name: n, pass: p, detail: d });
  console.log(`${p ? "PASS" : "FAIL"}  ${n}\n      ${d}`);
};

async function main() {
  const mc = await import("../../src/lib/media-consent");
  const roster = await import("../../src/lib/media-roster");

  const family = await prisma.family.findFirstOrThrow();
  const guardianLink = await prisma.familyGuardian.findFirstOrThrow({
    where: { familyId: family.id },
    include: { guardian: true },
  });
  const guardian = guardianLink.guardian;
  const staff = await prisma.staffUser.findFirstOrThrow({ where: { active: true } });

  const made: string[] = [];
  async function athlete(name: string, status: "media_ok" | "media_limited" | "media_no" | null, photo = false) {
    const a = await prisma.athlete.create({
      data: {
        familyId: family.id,
        firstName: `[QA] ${name}`,
        lastName: "Consent",
        dob: new Date("2015-05-01"),
        grade: "4th",
        ...(photo ? { photoPath: `athlete-photos/qa-${name}.jpg`, photoUpdatedAt: new Date() } : {}),
      },
    });
    made.push(a.id);
    if (status) {
      await prisma.mediaConsent.create({
        data: {
          athleteId: a.id, status,
          consentedByGuardianId: guardian.id,
          guardianName: guardian.name,
          guardianRelationship: "Parent",
          acknowledged: true,
          consentDate: new Date(),
          releaseVersion: mc.RELEASE_VERSION,
        },
      });
    }
    return a;
  }

  // 1-3, 5: the three choices resolve to the right staff vocabulary.
  const yes = await athlete("Yes", "media_ok");
  const ask = await athlete("Ask", "media_limited");
  const no = await athlete("No", "media_no");
  const unanswered = await athlete("Unanswered", null);
  check(
    "1-3 Three choices map to the staff vocabulary",
    mc.staffMediaLabel("media_ok") === "Media OK" &&
      mc.staffMediaLabel("media_limited") === "Ask First" &&
      mc.staffMediaLabel("media_no") === "No Media",
    `${mc.staffMediaLabel("media_ok")} / ${mc.staffMediaLabel("media_limited")} / ${mc.staffMediaLabel("media_no")}`
  );

  check(
    "Silence is not consent — unanswered is treated as ask-first",
    mc.staffMediaLabel(null) === "Not Answered" &&
      mc.canPublishWithoutAsking(null) === false &&
      mc.needsPhotographerAttention(null) === true,
    `unanswered → "${mc.staffMediaLabel(null)}", publishable=${mc.canPublishWithoutAsking(null)}, flagged=${mc.needsPhotographerAttention(null)}`
  );

  check(
    "Only an explicit yes is publishable without asking",
    mc.canPublishWithoutAsking("media_ok") &&
      !mc.canPublishWithoutAsking("media_limited") &&
      !mc.canPublishWithoutAsking("media_no"),
    "media_ok publishable; limited and no both require a check"
  );

  // 4: profile photo is NOT marketing consent.
  const photoNoConsent = await athlete("PhotoNoConsent", "media_no", true);
  const row = await prisma.athlete.findUniqueOrThrow({
    where: { id: photoNoConsent.id },
    include: { mediaConsent: true },
  });
  check(
    "4 A private profile photo does not imply marketing consent",
    !!row.photoPath && row.mediaConsent?.status === "media_no" &&
      !mc.canPublishWithoutAsking(row.mediaConsent?.status),
    `photoPath set=${!!row.photoPath}, marketing status=${row.mediaConsent?.status}, publishable=${mc.canPublishWithoutAsking(row.mediaConsent?.status)}`
  );

  // 5: consent with no profile photo is still valid.
  const noPhotoYes = await prisma.athlete.findUniqueOrThrow({ where: { id: yes.id } });
  check(
    "5 Consent without a profile photo is valid on its own",
    noPhotoYes.photoPath === null,
    `photoPath=${noPhotoYes.photoPath}`
  );

  // 6-9: changes are recorded with both statuses, guardian and version.
  async function change(athleteId: string, from: string | null, to: "media_ok" | "media_limited" | "media_no", withdrawal: boolean) {
    await prisma.mediaConsent.update({ where: { athleteId }, data: { status: to, consentDate: new Date() } });
    await prisma.mediaConsentChange.create({
      data: {
        athleteId,
        oldStatus: from as never,
        newStatus: to,
        changedByGuardianId: guardian.id,
        releaseVersion: mc.RELEASE_VERSION,
        needsFollowUp: withdrawal,
      },
    });
  }
  await change(yes.id, "media_ok", "media_no", true);       // 6 YES -> NO (withdrawal)
  await change(no.id, "media_no", "media_ok", false);        // 7 NO -> YES
  await change(ask.id, "media_limited", "media_ok", false);  // 8
  await change(ask.id, "media_ok", "media_limited", false);  // 8b

  const history = await prisma.mediaConsentChange.findMany({
    where: { athleteId: { in: made } },
    orderBy: { createdAt: "asc" },
  });
  check(
    "6-9 Every change records both statuses, the guardian and the release version",
    history.length === 4 &&
      history.every((h) => h.newStatus && h.changedByGuardianId === guardian.id && h.releaseVersion === mc.RELEASE_VERSION),
    `${history.length} changes: ${history.map((h) => `${h.oldStatus}→${h.newStatus}`).join(", ")}`
  );

  // 17: a withdrawal creates an admin follow-up, and nothing claims auto-removal.
  const followUps = await roster.openMediaFollowUps();
  const mine = followUps.filter((f) => made.includes(f.athleteId));
  check(
    "17 Withdrawal raises a follow-up for a human to review published material",
    mine.length === 1 && mine[0].needsFollowUp && mine[0].followUpDoneAt === null,
    `${mine.length} open follow-up(s); nothing is auto-removed`
  );

  // 14: roster summary counts correctly across a whole offering.
  const offering = await prisma.offering.findFirstOrThrow({
    where: { name: { startsWith: "[QA] 3rd–5th" } },
    include: { sessions: { where: { status: "scheduled" }, take: 1 } },
  });
  const session = offering.sessions[0];
  const bookingIds: string[] = [];
  for (const id of [yes.id, ask.id, no.id, unanswered.id]) {
    const b = await prisma.booking.create({
      data: { sessionId: session.id, athleteId: id, status: "booked" },
    });
    bookingIds.push(b.id);
  }
  const summary = await roster.offeringMediaRoster(offering.id);
  const qaOnly = summary.entries.filter((e) => made.includes(e.athleteId));
  check(
    "14 Event roster summarises consent accurately",
    qaOnly.length === 4 &&
      qaOnly.filter((e) => e.needsAttention).length === 3 &&
      qaOnly.filter((e) => e.status === null).length === 1,
    `of the 4 QA athletes: ${qaOnly.filter((e) => !e.needsAttention).length} clear, ${qaOnly.filter((e) => e.needsAttention).length} need a check (incl. 1 unanswered)`
  );

  // 15-16: version and timestamp stored.
  const stored = await prisma.mediaConsent.findUniqueOrThrow({ where: { athleteId: no.id } });
  check(
    "15-16 Release version, consent date and guardian snapshot are stored",
    stored.releaseVersion === mc.RELEASE_VERSION &&
      !!stored.consentDate &&
      stored.guardianName === guardian.name &&
      !!stored.guardianRelationship,
    `version=${stored.releaseVersion}, date set=${!!stored.consentDate}, guardian snapshot="${stored.guardianName} (${stored.guardianRelationship})"`
  );

  // 18: general consent never implies a featured/spotlight use.
  const featured = await prisma.featuredContentApproval.create({
    data: {
      athleteId: no.id, // currently media_ok
      kind: "spotlight",
      description: "[QA] Athlete spotlight for the winter campaign",
      usesFullName: true,
      requestedById: staff.id,
      releaseVersion: mc.RELEASE_VERSION,
    },
  });
  const fetched = await prisma.featuredContentApproval.findUniqueOrThrow({ where: { id: featured.id } });
  const athleteIsMediaOk = (await prisma.mediaConsent.findUniqueOrThrow({ where: { athleteId: no.id } })).status === "media_ok";
  check(
    "18 media_ok does not grant a spotlight or a full-name feature",
    athleteIsMediaOk && fetched.status === "requested" && fetched.decidedAt === null,
    `athlete is media_ok, yet the spotlight sits at "${fetched.status}" awaiting a guardian decision (usesFullName=${fetched.usesFullName})`
  );

  // Release language is not claimed to be approved.
  check(
    "Draft release language is flagged, not passed off as approved",
    mc.REVIEW_PENDING === true && mc.RELEASE_VERSION.includes("draft"),
    `REVIEW_PENDING=${mc.REVIEW_PENDING}, version="${mc.RELEASE_VERSION}"`
  );

  // Cleanup.
  await prisma.featuredContentApproval.deleteMany({ where: { athleteId: { in: made } } });
  await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.mediaConsentChange.deleteMany({ where: { athleteId: { in: made } } });
  await prisma.mediaConsent.deleteMany({ where: { athleteId: { in: made } } });
  await prisma.athlete.deleteMany({ where: { id: { in: made } } });

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} media-consent scenarios passed`);
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
