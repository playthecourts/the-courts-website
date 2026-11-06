// Tue Dec 1, 2026 only: cancel Volleyball Performance (6–7pm), then move
// Speed + Agility from 7pm to 6–7pm. Uses the app's own cancelSession /
// moveSession (scope "this") so ScheduleChange history is written the same
// way Courts OS does it. Neither sends notifications or touches refunds.
//
//   npx tsx --conditions=react-server scripts/dec1-2026-move-speed-agility-cancel-performance.ts           preview
//   npx tsx --conditions=react-server scripts/dec1-2026-move-speed-agility-cancel-performance.ts --apply   apply
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { cancelSession, moveSession } from "../src/lib/programs/scheduling";
import { findConflicts } from "../src/lib/programs/conflicts";

const APPLY = process.argv.includes("--apply");
const PERFORMANCE = "de844236-669d-45d5-a54c-416e4c8597e5";
const SPEED = "b421bcd4-87c8-4159-aea7-218afc9948b9";
const MELISSA = "df4f050c-de35-4162-a0a6-d877a0b09d6c";
const newStart = new Date("2026-12-01T18:00:00Z"), newEnd = new Date("2026-12-01T19:00:00Z");

async function describe(id: string) {
  const s = await prisma.session.findUniqueOrThrow({
    where: { id },
    include: {
      offering: { select: { id: true, name: true, registrations: { where: { status: { notIn: ["cancelled", "started"] as never } }, select: { status: true, selection: true, athlete: { select: { firstName: true, lastName: true } } } } } },
      coaches: { select: { staffUserId: true, staff: { select: { name: true } } } },
      extraResources: true,
      bookings: { where: { status: { not: "cancelled" } }, select: { athlete: { select: { firstName: true, lastName: true } } } },
    },
  });
  console.log(`${s.offering?.name}  ${s.startTime.toISOString()}–${s.endTime.toISOString().slice(11, 16)}  status=${s.status}  coach=${s.coaches.map((c) => c.staff.name).join(",")}  bookings=${s.bookings.length}  offeringRegistrations=${s.offering?.registrations.length}`);
  for (const r of s.offering?.registrations ?? []) console.log(`   reg: ${r.athlete.firstName} ${r.athlete.lastName} (${r.status}, ${r.selection})`);
  return s;
}

async function main() {
  const perf = await describe(PERFORMANCE);
  const speed = await describe(SPEED);
  if (perf.status !== "scheduled" || speed.status !== "scheduled") throw new Error("Unexpected status; stopping.");
  const occ = { startTime: newStart, endTime: newEnd, coachIds: speed.coaches.map((c) => c.staffUserId), resourceIds: [speed.resourceId, ...speed.extraResources.map((r) => r.resourceId)].filter(Boolean) as string[], excludeSessionId: SPEED };
  const pre = await findConflicts([occ]);
  console.log("\nConflicts at 6pm BEFORE cancelling Performance:", pre.map((c) => `${c.severity}: ${c.message ?? c.type}`));
  if (!APPLY) return console.log("\nPreview only. Add --apply.");

  console.log("\n", await cancelSession({ sessionId: PERFORMANCE, scope: "this", reason: "Schedule change — Speed + Agility moved into this slot", restoreCredits: true, notifyFamilies: false, notifyCoach: false, actorId: MELISSA }));
  const post = await findConflicts([occ]);
  console.log("Conflicts at 6pm AFTER cancelling:", post.map((c) => `${c.severity}: ${c.message ?? c.type}`));
  if (post.some((c) => c.severity === "blocking")) throw new Error("Blocking conflict remains; Speed + Agility NOT moved.");
  console.log(await moveSession({ sessionId: SPEED, newStart, newEnd, scope: "this", reason: "Moved from 7pm to 6pm for Dec 1", notifyFamilies: false, notifyCoach: false, actorId: MELISSA }));
  console.log("\nAfter:"); await describe(PERFORMANCE); await describe(SPEED);
}
main().finally(() => prisma.$disconnect());
