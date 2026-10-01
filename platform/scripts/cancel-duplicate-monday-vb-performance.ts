// Cancel the duplicate Monday 6:00 PM Volleyball Performance sessions.
//
// From Oct 19 every Monday had TWO Volleyball Performance sessions at 6:00 PM
// (Coach Justin): one with 12 seats (the real one) and one with 8 seats (the
// duplicate). Mondays should be Volleyball Development 5:00, Performance 6:00.
// This cancels only the 8-seat duplicates, only where nobody is booked, and
// only on a Monday that also has the 12-seat session. Each cancel is written
// the same way the app's cancelSession does it (status, reason, change history).
//
//   npx tsx scripts/cancel-duplicate-monday-vb-performance.ts          preview
//   npx tsx scripts/cancel-duplicate-monday-vb-performance.ts --apply  cancel
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const OFFERING_ID = "e52e5ffb-e835-499b-9a11-3e61c8cb060b"; // Volleyball Performance
const APPLY = process.argv.includes("--apply");

async function main() {
  const sessions = await prisma.session.findMany({
    where: { offeringId: OFFERING_ID, status: "scheduled", startTime: { gte: new Date("2026-10-01T00:00:00Z") } },
    include: { _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } } },
    orderBy: { startTime: "asc" },
  });
  // Times are stored as UTC wall clock, as everywhere else in the app.
  const mon6 = sessions.filter((s) => s.startTime.getUTCDay() === 1 && s.startTime.getUTCHours() === 18 && s.startTime.getUTCMinutes() === 0);
  const byDay: Record<string, typeof mon6> = {};
  for (const s of mon6) (byDay[s.startTime.toISOString().slice(0, 10)] ??= []).push(s);

  const targets: typeof mon6 = [];
  for (const [day, list] of Object.entries(byDay)) {
    const real = list.find((s) => s.capacity === 12);
    const dupes = list.filter((s) => s.capacity === 8);
    if (!real || !dupes.length) { console.log(`  ${day}: ${list.length} session(s), nothing to do`); continue; }
    for (const d of dupes) {
      if (d._count.bookings > 0) { console.log(`  ${day}: 8-seat duplicate has ${d._count.bookings} booking(s) — LEFT ALONE`); continue; }
      targets.push(d);
      console.log(`  ${day}: cancel 8-seat duplicate (0 booked); keep 12-seat (${real._count.bookings} booked)`);
    }
  }
  console.log(`\n${targets.length} duplicate session(s) to cancel.`);
  if (!APPLY) return console.log("Preview only. Add --apply to cancel them.");

  const ref = await prisma.scheduleChange.findFirst({
    where: { changeType: "moved", createdAt: { gte: new Date("2026-09-30T21:46:00Z"), lt: new Date("2026-09-30T21:47:00Z") } },
    select: { changedById: true },
  });
  if (!ref?.changedById) throw new Error("Could not find the admin user to record this change under.");
  const reason = "Duplicate Monday Volleyball Performance session";
  await prisma.$transaction(async (tx) => {
    for (const t of targets) {
      const live = await tx.booking.count({ where: { sessionId: t.id, status: { not: "cancelled" } } });
      if (live > 0) throw new Error(`Session ${t.id} now has ${live} booking(s) — stopping, nothing cancelled.`);
      await tx.session.update({
        where: { id: t.id },
        data: { status: "cancelled", cancellationReason: reason, cancelledAt: new Date(), cancelledById: ref.changedById },
      });
      await tx.scheduleChange.create({
        data: {
          sessionId: t.id, offeringId: t.offeringId, changeType: "cancelled",
          previousValue: "Scheduled", newValue: "Cancelled", reason,
          familiesNotified: false, coachNotified: false, affectedRegistrations: 0, changedById: ref.changedById,
        },
      });
    }
  });
  console.log(`Cancelled ${targets.length}.`);
}
main().finally(() => prisma.$disconnect());
