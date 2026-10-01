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
// The batch was NOT a uniform shift: it also moved some sessions that were
// at :30 onto the hour (e.g. Monday volleyball 4:30 → 5:00). Those are right
// now and are left alone. Rules, per session in the batch:
//   • Camps / Day Off, Game On: set straight to the new camp hours —
//     volleyball 9:00 AM–12:00 PM, basketball 1:00–4:00 PM, same date.
//   • Dr. Dish Self-Serve: restore the original 30-minute slot.
//   • Everything else: restore ONLY if the batch moved it from :00 to :30.
//     Otherwise it's left as is.
// Afterwards the preview lists any non-Dr. Dish session still starting at :30.
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

  const plan: { id: string; name: string; from: string; to: string; start: Date; end: Date; regs: number; rule: string }[] = [];
  const leftAlone: string[] = [];
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
    const name = s.offering?.name ?? "?";
    const [pStart, pEnd] = parseRange(c.previousValue ?? "", s.startTime);
    let start: Date, end: Date, rule: string;
    if (/camp|day off/i.test(name)) {
      const vb = /volleyball/i.test(name);
      const d = s.startTime;
      start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), vb ? 9 : 13, 0));
      end = new Date(start.getTime() + 3 * 3600_000);
      rule = vb ? "camp → 9–12" : "camp → 1–4";
    } else if (/dr\. dish/i.test(name)) {
      start = pStart; end = pEnd; rule = "Dr. Dish restore";
    } else if (pStart.getUTCMinutes() === 0 && s.startTime.getUTCMinutes() === 30) {
      start = pStart; end = pEnd; rule = "back to the hour";
    } else {
      leftAlone.push(`${name}: ${nowVal}  (batch moved it from ${c.previousValue}; already on the hour or not a :00→:30 move)`);
      continue;
    }
    plan.push({ id: s.id, name, from: nowVal, to: `${fmt(start)}–${fmt(end)}`, start, end, regs: 0, rule });
  }

  // Summarise as patterns: "Basketball Development: Wed 6:30 PM → 6:00 PM ×12"
  const hm = (d: Date) => norm(new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(d));
  const wd = (d: Date) => new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(d);
  const pat: Record<string, number> = {};
  for (const p of plan) {
    const cur = parseRange(p.from, p.start);
    const k = `${p.name}: ${wd(p.start)} ${hm(cur[0])}–${hm(cur[1])}  →  ${hm(p.start)}–${hm(p.end)}`;
    pat[k] = (pat[k] ?? 0) + 1;
  }
  console.log(`Batch ${batchArg} UTC: ${changes.length} change rows → ${plan.length} to fix, ${leftAlone.length} already right (left alone), ${skipped.length} skipped.\n`);
  console.log("WILL CHANGE (pattern × count):");
  for (const [k, n] of Object.entries(pat).sort()) console.log(`  ${k}  ×${n}`);
  const la: Record<string, number> = {};
  for (const l of leftAlone) { const k = l.split(":")[0]; la[k] = (la[k] ?? 0) + 1; }
  console.log("\nLEFT ALONE (already on the hour after the batch):");
  for (const [k, n] of Object.entries(la).sort()) console.log(`  ${k}  ×${n}`);
  if (skipped.length) {
    console.log("\nSKIPPED (changed since, or cancelled):");
    for (const x of skipped) console.log("  " + x);
  }
  // What would still start at :30 afterwards (outside Dr. Dish)?
  const fixed = new Set(plan.map((p) => p.id));
  const still = await prisma.session.findMany({
    where: { status: "scheduled", startTime: { gte: new Date("2026-10-01T00:00:00Z") } },
    include: { offering: { select: { name: true } } },
  });
  const stillHalf = still.filter((x) => !fixed.has(x.id) && x.startTime.getUTCMinutes() === 30 && !/dr\. dish/i.test(x.offering?.name ?? ""));
  const sh: Record<string, number> = {};
  for (const x of stillHalf) { const k = `${x.offering?.name}: ${wd(x.startTime)} ${hm(x.startTime)}`; sh[k] = (sh[k] ?? 0) + 1; }
  console.log(`\nSTILL AT :30 AFTERWARDS (not touched by this script): ${stillHalf.length}`);
  for (const [k, n] of Object.entries(sh).sort()) console.log(`  ${k}  ×${n}`);

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
          reason: `Fix bulk move of ${batchArg} UTC (${p.rule})`,
          changedById: actorId,
        },
      });
    }
  }, { timeout: 120_000 });
  console.log(`\nRestored ${plan.length} sessions.`);
}

main().finally(() => prisma.$disconnect());
