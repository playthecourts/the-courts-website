import "dotenv/config";
import Module from "node:module";
const _load = (Module as unknown as { _load: (r: string, p: unknown, m: boolean) => unknown })._load;
(Module as unknown as { _load: unknown })._load = function (request: string, parent: unknown, isMain: boolean) {
  if (request === "server-only") return {};
  return _load.call(this, request, parent, isMain);
};

import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }) });

// Mutation scenarios. Each makes a real change and then verifies the
// consequences, including that registrations survived.

const results: { name: string; pass: boolean; detail: string }[] = [];
const check = (name: string, pass: boolean, detail: string) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
};

async function main() {
  const { createSessions, moveSession, cancelSession, previewSchedule } = await import("../../src/lib/programs/scheduling");
  const { loadParentFeed } = await import("../../src/lib/programs/parent-feed");
  const { resolveBookingRule } = await import("../../src/lib/programs/pricing");

  const staff = await prisma.staffUser.findFirstOrThrow({ where: { active: true } });
  const offering = await prisma.offering.findFirstOrThrow({
    where: { name: { startsWith: "[QA] 3rd–5th" } },
    include: { sessions: { where: { status: "scheduled" }, orderBy: { startTime: "asc" } } },
  });
  const court2 = await prisma.resource.findFirstOrThrow({ where: { name: { startsWith: "[QA] Court 2" } } });

  // ---------- Preview then create a series ----------
  const spec = {
    kind: "recurring" as const,
    startDate: "2027-01-05",
    occurrenceCount: 4,
    frequency: "weekly" as const,
    weekdays: [2 as const],
    window: { startMinute: 19 * 60, durationMinutes: 60 },
  };
  const preview = await previewSchedule(offering.id, spec, [court2.id], []);
  const created = await createSessions({
    offeringId: offering.id, spec, resourceIds: [court2.id], coachIds: [staff.id],
    capacity: 8, saveAsSeries: true, actorId: staff.id,
  });
  const series = await prisma.recurrenceRule.findFirst({
    where: { offeringId: offering.id }, orderBy: { createdAt: "desc" },
  });
  check(
    "Preview matches what gets created, and the series rule is stored",
    preview.occurrences.length === 4 && created.length === 4 && !!series &&
      created.every((s) => s.seriesId === series!.id) &&
      created.every((s) => s.programId === offering.programId),
    `previewed ${preview.occurrences.length}, created ${created.length}, seriesId set on all, programId invariant held`
  );

  // ---------- S2: move ONE occurrence, series intact, registration attached ----
  const target = created[1];
  const athlete = await prisma.athlete.findFirstOrThrow();
  const booking = await prisma.booking.create({
    data: { sessionId: target.id, athleteId: athlete.id, status: "booked", creditSource: "QA test" },
  });

  await moveSession({
    sessionId: target.id,
    newStart: new Date(target.startTime.getTime() + 3600_000),
    newEnd: new Date(target.endTime.getTime() + 3600_000),
    scope: "this",
    reason: "QA: moved one occurrence",
    notifyFamilies: true, notifyCoach: true, actorId: staff.id,
  });

  const afterMove = await prisma.session.findUniqueOrThrow({
    where: { id: target.id },
    include: { _count: { select: { bookings: { where: { status: "booked" } } } } },
  });
  const siblings = await prisma.session.findMany({ where: { seriesId: series!.id } });
  const movedOnlyOne = siblings.filter(
    (s) => s.startTime.getUTCHours() === 20
  ).length;
  const changeRow = await prisma.scheduleChange.findFirst({
    where: { sessionId: target.id, changeType: "moved" },
  });
  check(
    "S2 One occurrence moves; series intact, booking attached, change logged",
    afterMove.startTime.getUTCHours() === 20 &&
      afterMove.isException === true &&
      siblings.length === 4 && movedOnlyOne === 1 &&
      afterMove._count.bookings === 1 &&
      !!changeRow && changeRow.familiesNotified === true &&
      changeRow.affectedRegistrations === 1,
    `moved to ${afterMove.startTime.toISOString()}, isException=${afterMove.isException}, ${movedOnlyOne}/4 shifted, booking kept=${afterMove._count.bookings}, logged="${changeRow?.previousValue} → ${changeRow?.newValue}" notified=${changeRow?.familiesNotified}`
  );

  // ---------- Move this-and-future ----------
  await moveSession({
    sessionId: created[2].id,
    newStart: new Date(created[2].startTime.getTime() + 1800_000),
    newEnd: new Date(created[2].endTime.getTime() + 1800_000),
    scope: "this_and_future",
    reason: "QA: shift the tail",
    notifyFamilies: false, notifyCoach: true, actorId: staff.id,
  });
  const tail = await prisma.session.findMany({ where: { seriesId: series!.id }, orderBy: { startTime: "asc" } });
  const untouchedException = tail.find((s) => s.id === target.id)!;
  const hhmm = (d: Date) => d.toISOString().slice(11, 16);
  // The first session precedes the edit and keeps 19:00; the exception keeps
  // its deliberate 20:00; the two at and after the edit point shift to 19:30.
  const first = tail.find((s) => s.id === created[0].id)!;
  const shifted = tail.filter((s) => s.id === created[2].id || s.id === created[3].id);
  check(
    "This-and-future shifts only the tail and leaves a deliberate exception alone",
    hhmm(first.startTime) === "19:00" &&
      hhmm(untouchedException.startTime) === "20:00" &&
      untouchedException.isException === true &&
      shifted.length === 2 &&
      shifted.every((s) => hhmm(s.startTime) === "19:30"),
    `before-edit=${hhmm(first.startTime)}, exception=${hhmm(untouchedException.startTime)} (untouched), shifted=[${shifted.map((s) => hhmm(s.startTime)).join(", ")}]`
  );

  // ---------- S15: cancel with credit restoration ----------
  const cancelResult = await cancelSession({
    sessionId: target.id, scope: "this",
    reason: "QA: Courts-side cancellation",
    restoreCredits: true, notifyFamilies: true, notifyCoach: true, actorId: staff.id,
  });
  const afterCancel = await prisma.session.findUniqueOrThrow({ where: { id: target.id } });
  const bookingAfter = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
  const cancelChange = await prisma.scheduleChange.findFirst({
    where: { sessionId: target.id, changeType: "cancelled" },
  });
  check(
    "S15 Cancellation: reason recorded, credit restored once, audit trail written",
    afterCancel.status === "cancelled" &&
      afterCancel.cancellationReason === "QA: Courts-side cancellation" &&
      bookingAfter.status === "cancelled" &&
      bookingAfter.creditRestored === true &&
      cancelResult.creditsRestored === 1 &&
      !!cancelChange && cancelChange.familiesNotified === true,
    `session=${afterCancel.status}, booking=${bookingAfter.status}, creditRestored=${bookingAfter.creditRestored}, restored=${cancelResult.creditsRestored}, logged=${!!cancelChange}`
  );

  // ---------- Training Plan booking rule ----------
  // Only checks that a rule resolves for a real member here; the substantive
  // credit assertions (consumes one, reports the balance, refuses to give
  // sessions away once the allowance is spent, restores on cancellation) live
  // in qa-credits.ts, which sets up the entitlement this offering needs.
  const memberAthlete = await prisma.athleteMembership.findFirst({
    where: { status: "active" }, include: { athlete: true, plan: true },
  });
  if (memberAthlete) {
    const liveSession = await prisma.session.findFirstOrThrow({
      where: { offeringId: offering.id, status: "scheduled" }, orderBy: { startTime: "asc" },
    });
    const rule = await resolveBookingRule(memberAthlete.athleteId, offering.id, liveSession.startTime);
    const KINDS = ["uses_credit", "credit_exhausted", "included", "member_price", "full_price", "free"];
    check(
      "S14 A booking rule always resolves to one of the stated kinds",
      KINDS.includes(rule.kind),
      `${memberAthlete.plan.name} on "${offering.name}" (creditRule=${offering.creditRule}) → ${rule.kind}. Full credit behaviour: see npm run qa:credits`
    );
  }

  // ---------- Parent feed respects publish + eligibility ----------
  const athletes = await prisma.athlete.findMany({ take: 4 });
  const feed = await loadParentFeed(athletes as never, {});
  const draftLeak = feed.filter((c) => c.offeringName.includes("Unpublished"));
  const internalLeak = feed.filter((c) => c.offeringName.includes("Internal Staff"));
  const hasNotes = feed.some((c) => JSON.stringify(c).includes("internalNotes"));
  check(
    "Parent feed: no drafts, no internal-only, no internal notes",
    draftLeak.length === 0 && internalLeak.length === 0 && !hasNotes,
    `${feed.length} cards; draft leaks=${draftLeak.length}, internal leaks=${internalLeak.length}, internal notes present=${hasNotes}`
  );

  // ---------- Cleanup: remove only what this script created ----------
  await prisma.booking.deleteMany({ where: { id: booking.id } });
  await prisma.session.deleteMany({ where: { seriesId: series!.id } });
  await prisma.recurrenceRule.delete({ where: { id: series!.id } });

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} mutation scenarios passed`);
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
