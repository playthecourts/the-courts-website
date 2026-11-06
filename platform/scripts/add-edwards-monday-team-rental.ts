// Recurring team rental for Edwards: every Monday 6:00–8:00 AM, Nov 9 – Dec 28, 2026.
// Modeled the same way as the existing team rental in Courts OS: a whole-facility
// FacilityBlock (reason private_event), times stored as facility wall-clock in UTC
// (what localDateTime() in createFacilityBlock writes).
//
//   npx tsx scripts/add-edwards-monday-team-rental.ts            preview + conflicts
//   npx tsx scripts/add-edwards-monday-team-rental.ts --apply    create blocks
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const APPLY = process.argv.includes("--apply");
const NOTE = "Team rental – facility closed (Edwards)";
const EXISTING_RENTAL_BLOCK = "bc3b934a-f409-4a83-a57c-99e1f0f9a47c"; // Oct 21 team rental, for createdById

const dates: string[] = [];
for (let d = new Date("2026-11-09T00:00:00Z"); d <= new Date("2026-12-28T00:00:00Z"); d = new Date(d.getTime() + 7 * 86_400_000))
  dates.push(d.toISOString().slice(0, 10));

async function main() {
  const ref = await prisma.facilityBlock.findUnique({ where: { id: EXISTING_RENTAL_BLOCK }, select: { createdById: true, createdBy: { select: { name: true } } } });
  console.log(`createdBy: ${ref?.createdBy?.name ?? "?"} (${ref?.createdById})`);
  const toCreate: { start: Date; end: Date }[] = [];
  for (const day of dates) {
    const start = new Date(`${day}T06:00:00Z`), end = new Date(`${day}T08:00:00Z`);
    const overlap = { startTime: { lt: end }, endTime: { gt: start } };
    const [sessions, reservations, blocks] = await Promise.all([
      prisma.session.findMany({ where: { status: "scheduled", ...overlap }, select: { startTime: true, endTime: true, offering: { select: { name: true } }, program: { select: { name: true } }, _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } } } }),
      prisma.resourceReservation.findMany({ where: { status: "confirmed", ...overlap }, select: { startTime: true, family: { select: { name: true } } } }),
      prisma.facilityBlock.findMany({ where: overlap, select: { note: true, reason: true, startTime: true, endTime: true } }),
    ]);
    const already = blocks.some((b) => b.note === NOTE && +b.startTime === +start);
    const issues = [
      ...sessions.map((s) => `session "${s.offering?.name ?? s.program.name}" ${s.startTime.toISOString().slice(11, 16)}–${s.endTime.toISOString().slice(11, 16)} (${s._count.bookings} booked)`),
      ...reservations.map((r) => `rental ${r.family.name}`),
      ...blocks.filter((b) => b.note !== NOTE).map((b) => `block ${b.reason}: ${b.note}`),
    ];
    console.log(`Mon ${day} 6–8am  ${already ? "ALREADY EXISTS" : issues.length ? "CONFLICT: " + issues.join("; ") : "clear"}`);
    if (!already) toCreate.push({ start, end });
  }
  if (!APPLY) return console.log(`\n${toCreate.length} to create. Preview only; add --apply.`);
  const res = await prisma.facilityBlock.createMany({
    data: toCreate.map((t) => ({ resourceId: null, startTime: t.start, endTime: t.end, reason: "private_event" as const, note: NOTE, showOnWebsite: false, createdById: ref?.createdById ?? null })),
  });
  console.log(`\nCreated ${res.count} block(s).`);
}
main().finally(() => prisma.$disconnect());
