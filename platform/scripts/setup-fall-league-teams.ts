// Creates Team Orange / Black / White on the Fall 2026 League offering and
// places already-registered players by grade. Safe to re-run: existing teams
// are reused and already-placed players are left alone.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { autoPlaceLeague } from "../src/lib/league-placement";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const offering = await prisma.offering.findFirstOrThrow({ where: { name: "Fall 2026 Basketball League" } });
  const wanted = [
    { name: "Team Orange", division: "3rd/4th Grade" },
    { name: "Team Black", division: "3rd/4th Grade" },
    { name: "Team White", division: "6th/7th Grade" },
  ];
  for (const w of wanted) {
    const existing = await prisma.team.findFirst({ where: { offeringId: offering.id, name: w.name } });
    if (!existing) await prisma.team.create({ data: { programId: offering.programId, offeringId: offering.id, ...w } });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { assigned, skipped } = await autoPlaceLeague(prisma as any, offering.id);
  console.log("placed:", assigned);
  console.log("left for manual placement:", skipped);
  const teams = await prisma.team.findMany({ where: { offeringId: offering.id }, include: { members: true } });
  const ath = await prisma.athlete.findMany({ where: { id: { in: teams.flatMap((t) => t.members.map((m) => m.athleteId)) } } });
  for (const t of teams) {
    const by: Record<string, number> = {};
    t.members.forEach((m) => { const g = ath.find((a) => a.id === m.athleteId)?.grade ?? "?"; by[g] = (by[g] ?? 0) + 1; });
    console.log(t.name, t.members.length, by);
  }
}
main().finally(() => prisma.$disconnect());
