// No regular classes on Mondays when a camp is running.
// Cancels any scheduled, non-camp session on a camp Monday (Nov 23, Dec 21,
// Dec 28 2026), only where nobody is booked. Written the same way the app's
// cancelSession does it (status, reason, change history).
//
//   npx tsx scripts/cancel-camp-monday-evenings.ts          preview
//   npx tsx scripts/cancel-camp-monday-evenings.ts --apply  cancel
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const APPLY = process.argv.includes("--apply");
const DAYS = ["2026-11-23", "2026-12-21", "2026-12-28"];
const fmt = (d: Date) => new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(d);

async function main() {
  const targets: { id: string; offeringId: string | null; label: string }[] = [];
  for (const day of DAYS) {
    const from = new Date(day + "T00:00:00Z"), to = new Date(from.getTime() + 86_400_000);
    const sessions = await prisma.session.findMany({
      where: { status: "scheduled", startTime: { gte: from, lt: to } },
      include: { offering: { select: { name: true } }, _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } } },
      orderBy: { startTime: "asc" },
    });
    for (const s of sessions) {
      const name = s.offering?.name ?? "?";
      const label = `${fmt(s.startTime)} · ${name}`;
      if (/camp/i.test(name)) { console.log(`  keep    ${label}`); continue; }
      if (s._count.bookings > 0) { console.log(`  LEFT ALONE (${s._count.bookings} booked)  ${label}`); continue; }
      console.log(`  cancel  ${label}`);
      targets.push({ id: s.id, offeringId: s.offeringId, label });
    }
  }
  console.log(`\n${targets.length} session(s) to cancel.`);
  if (!APPLY) return console.log("Preview only. Add --apply to cancel them.");

  const ref = await prisma.scheduleChange.findFirst({
    where: { changeType: "moved", createdAt: { gte: new Date("2026-09-30T21:46:00Z"), lt: new Date("2026-09-30T21:47:00Z") } },
    select: { changedById: true },
  });
  if (!ref?.changedById) throw new Error("Could not find the admin user to record this change under.");
  const reason = "No regular classes on camp Mondays";
  await prisma.$transaction(async (tx) => {
    for (const t of targets) {
      const live = await tx.booking.count({ where: { sessionId: t.id, status: { not: "cancelled" } } });
      if (live > 0) throw new Error(`${t.label} now has ${live} booking(s) — stopping, nothing cancelled.`);
      await tx.session.update({ where: { id: t.id }, data: { status: "cancelled", cancellationReason: reason, cancelledAt: new Date(), cancelledById: ref.changedById } });
      await tx.scheduleChange.create({ data: { sessionId: t.id, offeringId: t.offeringId, changeType: "cancelled", previousValue: "Scheduled", newValue: "Cancelled", reason, familiesNotified: false, coachNotified: false, affectedRegistrations: 0, changedById: ref.changedById } });
    }
  });
  console.log(`Cancelled ${targets.length}.`);
}
main().finally(() => prisma.$disconnect());
