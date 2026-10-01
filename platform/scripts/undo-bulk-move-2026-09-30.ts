// Undo the bulk "moved" batch of 2026-09-30.
//
// On Sept 30 a single batch moved most sessions from early October onward 30
// minutes later and cut many to 60 minutes (camps 1:00–5:00 → 1:30–2:30,
// Dr. Dish 30-min slots → overlapping 60-min slots, every class to :30).
// Every move wrote a ScheduleChange row whose previousValue holds the exact
// original times, so this script restores from those rows.
//
// SAFE BY DEFAULT — it only reads and prints.
//
//   npx tsx scripts/undo-bulk-move-2026-09-30.ts
//       lists today's move batches (by minute) so you can see the bad one
//   npx tsx scripts/undo-bulk-move-2026-09-30.ts --batch 2026-09-30T21:46
//       previews exactly what would be restored for that batch (UTC minute)
//   npx tsx scripts/undo-bulk-move-2026-09-30.ts --batch 2026-09-30T21:46 --apply
//       restores, in one transaction, and logs a "moved" change on each
//
// A session is only restored if its current times still equal the batch's
// "after" value. Anything changed again since (by hand, or a later batch) is
// skipped and listed, never overwritten.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const args = process.argv.slice(2);
const batchArg = args.includes("--batch") ? args[args.indexOf("--batch") + 1] : null;
const APPLY = args.includes("--apply");

// Same formatter scheduling.ts uses for previousValue/newValue (UTC wall clock).
const fmt = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC",
  }).format(d);
const norm = (s: string) => s.replace(/[  ]/g, " ").trim();
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function parseOne(s: string, near: Date): Date {
  const m = norm(s).match(/^\w{3}, (\w{3}) (\d{1,2}), (\d{1,2}):(\d{2}) (AM|PM)$/);
  if (!m) throw new Error(`Unparseable time: "${s}"`);
  const mon = MONTHS.indexOf(m[1]);
  let h = Number(m[3]) % 12;
  if (m[5] === "PM") h += 12;
  const y0 = near.getUTCFullYear();
  const cands = [y0 - 1, y0, y0 + 1].map((y) => new Date(Date.UTC(y, mon, Number(m[2]), h, Number(m[4]))));
  return cands.sort((a, b) => Math.abs(a.getTime() - near.getTime()) - Math.abs(b.getTime() - near.getTime()))[0];
}
function parseRange(v: string, near: Date): [Date, Date] {
  const parts = norm(v).split("–");
  if (parts.length !== 2) throw new Error(`Unparseable range: "${v}"`);
  return [parseOne(parts[0], near), parseOne(parts[1], near)];
}

async function main() {
  if (!batchArg) {
    const rows = await prisma.scheduleChange.findMany({
      where: { changeType: "moved", createdAt: { gte: new Date("2026-09-29T00:00:00Z") } },
      select: { createdAt: true },
    });
    const by: Record<string, number> = {};
    for (const r of rows) {
      const k = r.createdAt.toISOString().slice(0, 16);
      by[k] = (by[k] ?? 0) + 1;
    }
    console.log("Move batches since Sept 29 (UTC minute → sessions moved):");
    for (const [k, n] of Object.entries(by).sort()) console.log(`  ${k}  ${n}`);
    console.log("\nRe-run with --batch <minute> to preview one.");
    return;
  }

  const from = new Date(batchArg + ":00Z");
  const to = new Date(from.getTime() + 60_000);
  const changes = await prisma.scheduleChange.findMany({
    where: { changeType: "moved", createdAt: { gte: from, lt: to }, sessionId: { not: null } },
    include: { session: { include: { offering: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  if (!changes.length) return console.log("No moves in that minute.");

  const plan: { id: string; name: string; from: string; to: string; start: Date; end: Date; regs: number }[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  for (const c of changes) {
    const s = c.session;
    if (!s || seen.has(s.id)) continue;
    seen.add(s.id);
    const label = `${s.offering?.name ?? "?"} · ${c.previousValue} → ${c.newValue}`;
    const nowVal = `${fmt(s.startTime)}–${fmt(s.endTime)}`;
    if (norm(nowVal) !== norm(c.newValue ?? "")) {
      skipped.push(`${label}  (changed since — now ${nowVal})`);
      continue;
    }
    if (s.status !== "scheduled") {
      skipped.push(`${label}  (status ${s.status})`);
      continue;
    }
    const [start, end] = parseRange(c.previousValue ?? "", s.startTime);
    plan.push({ id: s.id, name: s.offering?.name ?? "?", from: nowVal, to: `${fmt(start)}–${fmt(end)}`, start, end, regs: 0 });
  }

  const byName: Record<string, number> = {};
  for (const p of plan) byName[p.name] = (byName[p.name] ?? 0) + 1;
  console.log(`Batch ${batchArg} UTC: ${changes.length} change rows, ${plan.length} sessions to restore, ${skipped.length} skipped.\n`);
  for (const [n, k] of Object.entries(byName).sort()) console.log(`  ${k.toString().padStart(3)}  ${n}`);
  console.log("\nFirst 25:");
  for (const p of plan.slice(0, 25)) console.log(`  ${p.name}: ${p.from}  →  ${p.to}`);
  if (skipped.length) {
    console.log("\nSkipped (left alone):");
    for (const s of skipped) console.log("  " + s);
  }

  if (!APPLY) return console.log("\nPreview only. Add --apply to restore.");

  const actorId = changes[0].changedById;
  await prisma.$transaction(async (tx) => {
    for (const p of plan) {
      await tx.session.update({ where: { id: p.id }, data: { startTime: p.start, endTime: p.end } });
      await tx.scheduleChange.create({
        data: {
          sessionId: p.id,
          offeringId: (await tx.session.findUniqueOrThrow({ where: { id: p.id }, select: { offeringId: true } })).offeringId,
          changeType: "moved",
          previousValue: p.from,
          newValue: p.to,
          reason: `Undo bulk move of ${batchArg} UTC`,
          changedById: actorId,
        },
      });
    }
  }, { timeout: 120_000 });
  console.log(`\nRestored ${plan.length} sessions.`);
}

main().finally(() => prisma.$disconnect());
