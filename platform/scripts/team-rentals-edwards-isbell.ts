// Team rentals done the way Courts OS already does them (Forni, Gaumnitz, Bennett,
// and the Nov 2 Edwards men's league): a Session on the draft "Private Birthday
// Party" offering (draft = never bookable in the Parent App), titled
// "Team Rental (Name)" / "Private Rental (...)" so playthecourts.com shows it as a
// named, non-bookable rental. Full Court, capacity 20, "Staff Member" as lead, 0 bookings.
//
// Also removes the 8 Edwards FacilityBlocks created 2026-11-06 (they hide from
// the marketing calendar). Run the Dec 1 Speed + Agility move first.
//
//   npx tsx scripts/team-rentals-edwards-isbell.ts            preview + conflicts
//   npx tsx scripts/team-rentals-edwards-isbell.ts --apply    apply (refuses on any conflict)
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const APPLY = process.argv.includes("--apply");
const OFFERING = "d8cf56f9-2918-40f5-a037-89e2172ea49b";
const FULL_COURT = "5a8e11fe-c140-4d9f-977c-3fd23105ef35";
const STAFF_PLACEHOLDER = "c354cee2-4b6f-4b28-95ec-870768443179";
const MELISSA = "df4f050c-de35-4162-a0a6-d877a0b09d6c";
const OLD_BLOCK_NOTE = "Team rental – facility closed (Edwards)";

const mondays: string[] = [];
for (let d = new Date("2026-11-09T00:00:00Z"); d <= new Date("2026-12-28T00:00:00Z"); d = new Date(d.getTime() + 7 * 86_400_000)) mondays.push(d.toISOString().slice(0, 10));
const plan = [
  ...mondays.map((day) => ({ day, from: "06:00", to: "08:00", title: "Private Rental (Men's League - Edwards)", note: "Alan Edwards men's league, Mondays 6–8 AM through Dec 28." })),
  ...["2026-11-30", "2026-12-01"].map((day) => ({ day, from: "19:00", to: "20:00", title: "Team Rental (Isbell)", note: "Court rental for Daniel Isbell (renter), 7–8 PM Nov 30 & Dec 1. $150 total for both dates via Stripe link." })),
];
const t = (d: Date) => d.toISOString().slice(11, 16);

async function main() {
  const off = await prisma.offering.findUniqueOrThrow({ where: { id: OFFERING }, select: { programId: true, status: true } });
  if (off.status !== "draft") throw new Error("Rental offering is no longer draft; stopping.");
  const fc = await prisma.resource.findUniqueOrThrow({ where: { id: FULL_COURT }, select: { overlapsResourceIds: true } });
  const courts = [FULL_COURT, ...fc.overlapsResourceIds];
  const oldBlocks = await prisma.facilityBlock.findMany({ where: { note: OLD_BLOCK_NOTE }, select: { id: true, startTime: true } });
  console.log(`Edwards FacilityBlocks to remove: ${oldBlocks.length}`);
  let conflicts = 0;
  const rows: { start: Date; end: Date; title: string; note: string }[] = [];
  for (const p of plan) {
    const start = new Date(`${p.day}T${p.from}:00Z`), end = new Date(`${p.day}T${p.to}:00Z`);
    const overlap = { startTime: { lt: end }, endTime: { gt: start } };
    const [sessions, blocks] = await Promise.all([
      prisma.session.findMany({ where: { status: "scheduled", ...overlap }, select: { title: true, startTime: true, endTime: true, resourceId: true, offering: { select: { name: true } } } }),
      prisma.facilityBlock.findMany({ where: { ...overlap, note: { not: OLD_BLOCK_NOTE } }, select: { note: true } }),
    ]);
    const dup = sessions.some((s) => s.title === p.title && +s.startTime === +start);
    const issues = [
      ...sessions.filter((s) => !(s.title === p.title && +s.startTime === +start)).map((s) => `"${s.title ?? s.offering?.name}" ${t(s.startTime)}–${t(s.endTime)}${s.resourceId && courts.includes(s.resourceId) ? " [same court]" : ""}`),
      ...blocks.map((b) => `block: ${b.note}`),
    ];
    conflicts += issues.length;
    console.log(`${p.day} ${p.from}–${p.to}  ${p.title}  ${dup ? "ALREADY EXISTS" : issues.length ? "CONFLICT: " + issues.join("; ") : "clear"}`);
    if (!dup) rows.push({ start, end, title: p.title, note: p.note });
  }
  if (!APPLY) return console.log(`\n${rows.length} session(s) to create. Preview only; add --apply.`);
  if (conflicts) throw new Error("Conflicts present; nothing changed.");
  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      const s = await tx.session.create({ data: { programId: off.programId, offeringId: OFFERING, resourceId: FULL_COURT, startTime: r.start, endTime: r.end, capacity: 20, title: r.title, internalNote: r.note } });
      await tx.sessionCoach.create({ data: { sessionId: s.id, staffUserId: STAFF_PLACEHOLDER, role: "lead" } });
      await tx.scheduleChange.create({ data: { sessionId: s.id, offeringId: OFFERING, changeType: "created", newValue: "1 session scheduled", changedById: MELISSA, affectedRegistrations: 0 } });
    }
    const del = await tx.facilityBlock.deleteMany({ where: { id: { in: oldBlocks.map((b) => b.id) } } });
    console.log(`Created ${rows.length} session(s); removed ${del.count} Edwards block(s).`);
  });
}
main().finally(() => prisma.$disconnect());
