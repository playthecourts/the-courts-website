// Merge duplicate staff records (e.g. "Johnny" and "Johnny Coles") so the
// coach picker shows each person once.
//
//   npx tsx scripts/merge-duplicate-staff.ts            preview — changes nothing
//   npx tsx scripts/merge-duplicate-staff.ts --apply    merge
//
// Duplicates = active staff sharing a first name. For each group one record is
// KEPT: the one the person actually uses (most logins-worth of activity: audit
// log entries, notes, attendance), then most class/team assignments, then the
// higher role. The others are merged into it: their upcoming class and team
// assignments move to the kept record, and the duplicate is switched to
// inactive (history stays attached, nothing is deleted). An inactive record
// can no longer sign in — check the emails in the preview before applying.
// Override the choice with --keep=email@x.com (repeatable).
// "Staff Member" (the TBD placeholder) is left alone.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const APPLY = process.argv.includes("--apply");
const KEEP = process.argv.filter((a) => a.startsWith("--keep=")).map((a) => a.slice(7).toLowerCase());
const ROLE_RANK: Record<string, number> = { owner: 4, admin: 3, head_coach: 2, coach: 1 };

async function main() {
  const now = new Date();
  const staff = await prisma.staffUser.findMany({
    where: { active: true, name: { not: "Staff Member" } },
    select: {
      id: true, name: true, email: true, role: true, createdAt: true,
      _count: {
        select: {
          auditLogs: true, sessionNotes: true, coachNotes: true, attendanceRecords: true,
          teamAssignments: true,
          sessionAssignments: true,
        },
      },
    },
  });

  const groups = new Map<string, typeof staff>();
  for (const s of staff) {
    const key = s.name.trim().split(/\s+/)[0].toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }

  const activity = (s: (typeof staff)[number]) =>
    s._count.auditLogs + s._count.sessionNotes + s._count.coachNotes + s._count.attendanceRecords;

  let any = false;
  for (const [first, list] of groups) {
    if (list.length < 2) continue;
    any = true;
    const ranked = [...list].sort(
      (a, b) =>
        Number(KEEP.includes(b.email.toLowerCase())) - Number(KEEP.includes(a.email.toLowerCase())) ||
        activity(b) - activity(a) ||
        b._count.sessionAssignments + b._count.teamAssignments - (a._count.sessionAssignments + a._count.teamAssignments) ||
        (ROLE_RANK[b.role] ?? 0) - (ROLE_RANK[a.role] ?? 0) ||
        a.createdAt.getTime() - b.createdAt.getTime()
    );
    const [keep, ...dups] = ranked;
    console.log(`\n${first.toUpperCase()}`);
    for (const s of ranked) {
      console.log(
        `  ${s === keep ? "KEEP " : "merge"}  ${s.name.padEnd(20)} ${s.email.padEnd(34)} ${s.role.padEnd(10)} ` +
          `activity ${activity(s)} · classes ${s._count.sessionAssignments} · teams ${s._count.teamAssignments}`
      );
    }
    if (!APPLY) continue;

    for (const d of dups) {
      await prisma.$transaction(async (tx) => {
        const upcoming = await tx.sessionCoach.findMany({
          where: { staffUserId: d.id, session: { startTime: { gte: now } } },
        });
        for (const a of upcoming) {
          const has = await tx.sessionCoach.findUnique({
            where: { sessionId_staffUserId: { sessionId: a.sessionId, staffUserId: keep.id } },
          });
          if (!has) await tx.sessionCoach.create({ data: { sessionId: a.sessionId, staffUserId: keep.id, role: a.role } });
          await tx.sessionCoach.delete({ where: { sessionId_staffUserId: { sessionId: a.sessionId, staffUserId: d.id } } });
        }
        const teams = await tx.teamCoach.findMany({ where: { staffUserId: d.id } });
        for (const t of teams) {
          const has = await tx.teamCoach.findUnique({ where: { teamId_staffUserId: { teamId: t.teamId, staffUserId: keep.id } } });
          if (!has) await tx.teamCoach.create({ data: { teamId: t.teamId, staffUserId: keep.id, role: t.role } });
          await tx.teamCoach.delete({ where: { teamId_staffUserId: { teamId: t.teamId, staffUserId: d.id } } });
        }
        await tx.coachAvailability.updateMany({ where: { staffUserId: d.id }, data: { staffUserId: keep.id } });
        await tx.staffUser.update({ where: { id: d.id }, data: { active: false } });
        console.log(`    merged ${d.name} → ${keep.name}: ${upcoming.length} upcoming classes, ${teams.length} teams moved`);
      });
    }
  }
  if (!any) console.log("No duplicate staff found.");
  console.log(APPLY ? "\nDone." : "\nPreview only. If the KEEP lines are right, run again with --apply.");
}

main().finally(() => prisma.$disconnect());
