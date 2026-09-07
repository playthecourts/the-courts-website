import "dotenv/config";
import Module from "node:module";

// The engines are marked "server-only" so they can never be bundled into a
// client component. That guard is correct in the app and unhelpful in a Node
// test harness, so it is stubbed out here — for this script only.
const _load = (Module as unknown as { _load: (r: string, p: unknown, m: boolean) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") return {};
  return _load.call(this, request, parent, isMain);
};
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Exercises the engines directly against the seeded QA data. Reports PASS/FAIL
// per scenario; makes no changes it does not undo.

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL });
const prisma = new PrismaClient({ adapter });
(globalThis as never as { __prisma: unknown }).__prisma = prisma;

const results: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}

async function main() {
  const { findConflicts } = await import("../../src/lib/programs/conflicts");
  const { checkReadiness } = await import("../../src/lib/programs/publish");
  const { availabilityFor } = await import("../../src/lib/programs/availability");
  const { expandSchedule } = await import("../../src/lib/programs/recurrence");
  const { checkAgeAndGrade } = await import("../../src/lib/programs/eligibility");
  const { offerNextSpot, waitlistSummary } = await import("../../src/lib/programs/waitlist");
  const { cloneOffering } = await import("../../src/lib/programs/templates");

  const staff = await prisma.staffUser.findFirstOrThrow({ where: { active: true } });

  // ---------- 1. Recurring generation ----------
  const occ = expandSchedule({
    kind: "recurring",
    startDate: "2026-10-06",
    endDate: "2026-12-15",
    frequency: "weekly",
    weekdays: [2],
    window: { startMinute: 17 * 60, durationMinutes: 60 },
  });
  check(
    "S1 Recurring generation",
    occ.length === 11 && occ[0].startTime.toISOString().startsWith("2026-10-06T17:00"),
    `Tue 5pm Oct 6 → Dec 15 produced ${occ.length} sessions, first ${occ[0].startTime.toISOString()}`
  );

  // ---------- 8. Court conflict ----------
  const busy = await prisma.session.findFirstOrThrow({
    where: { program: { name: { startsWith: "[QA]" } }, status: "scheduled", resourceId: { not: null } },
    include: { resource: true },
  });
  const courtClash = await findConflicts([
    { startTime: busy.startTime, endTime: busy.endTime, resourceIds: [busy.resourceId!], coachIds: [] },
  ]);
  const blockingCourt = courtClash.filter((c) => c.severity === "blocking" && c.type.startsWith("resource"));
  check(
    "S8 Court conflict blocks + names the clash",
    blockingCourt.length > 0 && blockingCourt[0].message.includes(busy.resource!.name),
    blockingCourt[0]?.message ?? "no conflict detected"
  );

  // ---------- Overlapping resource containment ----------
  const half = await prisma.resource.findFirst({ where: { name: { startsWith: "[QA] Half Court A" } } });
  const court1 = await prisma.resource.findFirst({ where: { name: { startsWith: "[QA] Court 1" } } });
  const onCourt1 = await prisma.session.findFirst({
    where: { resourceId: court1?.id, status: "scheduled" },
  });
  if (half && onCourt1) {
    const overlapClash = await findConflicts([
      { startTime: onCourt1.startTime, endTime: onCourt1.endTime, resourceIds: [half.id], coachIds: [] },
    ]);
    const hit = overlapClash.find((c) => c.severity === "blocking");
    check(
      "Overlapping resources block each other",
      !!hit,
      hit ? hit.message : "Half Court A did not conflict with a Court 1 booking"
    );
  }

  // ---------- 9. Coach conflict ----------
  const staffed = await prisma.session.findFirst({
    where: { program: { name: { startsWith: "[QA]" } }, status: "scheduled", coaches: { some: {} } },
    include: { coaches: true },
  });
  if (staffed) {
    const coachClash = await findConflicts([
      {
        startTime: staffed.startTime,
        endTime: staffed.endTime,
        resourceIds: [],
        coachIds: [staffed.coaches[0].staffUserId],
      },
    ]);
    const hit = coachClash.find((c) => c.type === "coach_double_booked");
    check("S9 Coach double-booking detected", !!hit, hit?.message ?? "no coach conflict detected");
  }

  // ---------- 10. Facility closure ----------
  const closure = await prisma.facilityBlock.findFirstOrThrow({ where: { note: { startsWith: "[QA]" } } });
  const inClosure = new Date(closure.startTime.getTime() + 3 * 3600_000);
  const closureClash = await findConflicts([
    { startTime: inClosure, endTime: new Date(inClosure.getTime() + 3600_000), resourceIds: [court1!.id], coachIds: [] },
  ]);
  const closureHit = closureClash.find((c) => c.type === "facility_closed");
  check("S10 Facility closure blocks scheduling", !!closureHit, closureHit?.message ?? "closure not detected");

  // ---------- 11. Stripe missing blocks publish ----------
  const broken = await prisma.offering.findFirstOrThrow({
    where: { name: { startsWith: "[QA] Clinic Missing Stripe" } },
  });
  const brokenReadiness = await checkReadiness(broken.id);
  const hasStripeBlocker = brokenReadiness.blockers.some((b) => b.label.includes("STRIPE"));
  const hasTaxBlocker = brokenReadiness.blockers.some((b) => b.label.includes("TAX"));
  check(
    "S11 Paid program without Stripe cannot publish",
    !brokenReadiness.ready && hasStripeBlocker && hasTaxBlocker,
    `ready=${brokenReadiness.ready}; blockers: ${brokenReadiness.blockers.map((b) => b.label).join(" | ")}`
  );

  // ---------- 6. Full session ----------
  const fullSession = await prisma.session.findFirstOrThrow({
    where: { capacity: 2, program: { name: { startsWith: "[QA]" } } },
    include: { offering: true, _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } } },
  });
  const avail = availabilityFor({
    status: fullSession.offering!.status,
    registrationOpensAt: fullSession.offering!.registrationOpensAt,
    registrationClosesAt: fullSession.offering!.registrationClosesAt,
    closeWhenFull: fullSession.offering!.closeWhenFull,
    waitlistMode: fullSession.offering!.waitlistMode,
    lowSpotThreshold: fullSession.offering!.lowSpotThreshold,
    capacity: fullSession.capacity,
    booked: fullSession._count.bookings,
  });
  check(
    "S6 Full session shows waitlist, not a book button",
    avail.state === "waitlist" && !avail.canRegister && avail.canJoinWaitlist,
    `state=${avail.state} label="${avail.label}" canRegister=${avail.canRegister}`
  );

  // ---------- 7. Waitlist promotion is an OFFER, not a booking ----------
  const before = await waitlistSummary(fullSession.id);
  const aBooking = await prisma.booking.findFirstOrThrow({
    where: { sessionId: fullSession.id, status: "booked" },
  });
  await prisma.booking.update({ where: { id: aBooking.id }, data: { status: "cancelled" } });
  const offer = await offerNextSpot(fullSession.id, staff.id);
  const after = await waitlistSummary(fullSession.id);
  const bookedAfter = await prisma.booking.count({
    where: { sessionId: fullSession.id, status: { not: "cancelled" } },
  });
  check(
    "S7 Freed seat is OFFERED, nobody auto-booked or charged",
    offer.kind === "offered" && after.offered === 1 && bookedAfter === 1,
    `offer=${offer.kind}; waiting ${before.waiting}→${after.waiting}, offered=${after.offered}, bookings now ${bookedAfter}`
  );
  // Undo
  await prisma.booking.update({ where: { id: aBooking.id }, data: { status: "booked" } });
  await prisma.waitlistEntry.updateMany({
    where: { sessionId: fullSession.id, status: "offered" },
    data: { status: "waiting", offeredAt: null, offerExpiresAt: null, offeredById: null },
  });

  // ---------- 12. Clone leaks nothing ----------
  const league = await prisma.offering.findFirstOrThrow({
    where: { name: { startsWith: "[QA] Winter Basketball League" } },
  });
  const clone = await cloneOffering(league.id, {
    name: "[QA] Clone Target League",
    seasonLabel: null,
    createdById: staff.id,
  });
  const cloneRow = await prisma.offering.findUniqueOrThrow({ where: { id: clone.id } });
  const cloneSessions = await prisma.session.count({ where: { offeringId: clone.id } });
  check(
    "S12 Clone copies structure, not dates/price/Stripe/season",
    cloneRow.status === "draft" &&
      cloneRow.priceCents === null &&
      cloneRow.stripePriceId === null &&
      cloneRow.seasonLabel === null &&
      cloneRow.startDate === null &&
      cloneSessions === 0 &&
      cloneRow.gradeMin === league.gradeMin,
    `status=${cloneRow.status} price=${cloneRow.priceCents} stripe=${cloneRow.stripePriceId} season=${cloneRow.seasonLabel} sessions=${cloneSessions} gradesCopied=${cloneRow.gradeMin === league.gradeMin}`
  );
  await prisma.offering.delete({ where: { id: clone.id } });

  // ---------- Eligibility ----------
  const g3 = checkAgeAndGrade(
    { id: "x", grade: "3rd", dob: new Date("2016-01-01"), gender: null },
    { gradeMin: 3, gradeMax: 5, ageMin: null, ageMax: null, gender: null, inviteOnly: false, requiresTrainingPlan: false },
    new Date()
  );
  const g8 = checkAgeAndGrade(
    { id: "y", grade: "8", dob: new Date("2011-01-01"), gender: null },
    { gradeMin: 3, gradeMax: 5, ageMin: null, ageMax: null, gender: null, inviteOnly: false, requiresTrainingPlan: false },
    new Date()
  );
  const noGrade = checkAgeAndGrade(
    { id: "z", grade: null, dob: new Date("2015-01-01"), gender: null },
    { gradeMin: 3, gradeMax: 5, ageMin: null, ageMax: null, gender: null, inviteOnly: false, requiresTrainingPlan: false },
    new Date()
  );
  check(
    "Eligibility: grade band in/out, and unknown grade asks rather than excludes",
    g3.eligible && !g8.eligible && !noGrade.eligible && noGrade.reason.includes("grade"),
    `3rd=${g3.eligible}, 8th=${g8.eligible}, unknown→"${!noGrade.eligible ? noGrade.reason : ""}"`
  );

  // ---------- Draft safety ----------
  const draft = await prisma.offering.findFirstOrThrow({
    where: { name: { startsWith: "[QA] Unpublished Shooting Clinic" } },
  });
  const visibleToParents = await prisma.session.count({
    where: {
      offeringId: draft.id,
      offering: { status: "published", visibleParentApp: true, internalOnly: false },
    },
  });
  check(
    "Draft safety: unpublished program is invisible to the Parent App",
    visibleToParents === 0,
    `draft "${draft.name}" (visibleParentApp=${draft.visibleParentApp}) matched ${visibleToParents} parent-visible sessions`
  );

  // ---------- Internal-only safety ----------
  const internal = await prisma.offering.findFirstOrThrow({
    where: { name: { startsWith: "[QA] Internal Staff Practice" } },
  });
  const internalVisible = await prisma.session.count({
    where: {
      offeringId: internal.id,
      offering: { status: "published", visibleParentApp: true, internalOnly: false },
    },
  });
  check(
    "Internal-only occupies the facility but reaches nobody",
    internalVisible === 0,
    `internal offering matched ${internalVisible} parent-visible sessions`
  );

  // ---------- Future + closed registration ----------
  const future = await prisma.offering.findFirstOrThrow({ where: { name: { startsWith: "[QA] Winter Volleyball Camp" } } });
  const futureAvail = availabilityFor({
    status: future.status, registrationOpensAt: future.registrationOpensAt,
    registrationClosesAt: future.registrationClosesAt, closeWhenFull: future.closeWhenFull,
    waitlistMode: future.waitlistMode, lowSpotThreshold: future.lowSpotThreshold,
    capacity: 24, booked: 0,
  });
  const closed = await prisma.offering.findFirstOrThrow({ where: { name: { startsWith: "[QA] Clinic With Registration Closed" } } });
  const closedAvail = availabilityFor({
    status: closed.status, registrationOpensAt: closed.registrationOpensAt,
    registrationClosesAt: closed.registrationClosesAt, closeWhenFull: closed.closeWhenFull,
    waitlistMode: closed.waitlistMode, lowSpotThreshold: closed.lowSpotThreshold,
    capacity: 12, booked: 0,
  });
  check(
    "Registration windows drive Coming Soon / Registration Closed",
    futureAvail.state === "coming_soon" && closedAvail.state === "registration_closed",
    `future="${futureAvail.label}", past-deadline="${closedAvail.label}"`
  );

  // ---------- Session.programId invariant ----------
  const drift = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM sessions s JOIN offerings o ON o.id = s.offering_id
    WHERE s.program_id <> o.program_id`;
  check(
    "Invariant: Session.programId always equals offering.programId",
    Number(drift[0].n) === 0,
    `${Number(drift[0].n)} drifted rows`
  );

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} scenarios passed`);
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
