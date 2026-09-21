import type { prisma as PrismaSingleton } from "@/lib/prisma";

type Db = typeof PrismaSingleton;

const gradeNumber = (g: string | null) => {
  const m = (g ?? "").match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
};

/// Places registered, not-yet-placed League players: 6th/7th grade -> the
/// White team; 3rd/4th grade -> split evenly between Orange and Black, grade
/// by grade (so each team gets the same number of 3rd graders and of 4th
/// graders, give or take one). Anyone else is left for a manual decision.
export async function autoPlaceLeague(db: Db, offeringId: string) {
  const teams = await db.team.findMany({ where: { offeringId }, include: { members: true } });
  const byName = (n: string) => teams.find((t) => t.name.toLowerCase() === n);
  const orange = byName("team orange");
  const black = byName("team black");
  const white = byName("team white");
  if (!orange || !black || !white) throw new Error("Team Orange, Team Black and Team White must all exist first.");

  const regs = await db.registration.findMany({
    where: { offeringId, status: { in: ["registered", "admin_review", "incomplete"] } },
  });
  const athletes = await db.athlete.findMany({ where: { id: { in: regs.map((r) => r.athleteId) } } });
  const placed = new Set(teams.flatMap((t) => t.members.map((m) => m.athleteId)));
  const todo = athletes.filter((a) => !placed.has(a.id));

  const counts: Record<string, number> = {};
  const count = (teamId: string, g: number) => teams.find((t) => t.id === teamId)!.members.filter((m) => {
    const a = athletes.find((x) => x.id === m.athleteId);
    return a && gradeNumber(a.grade) === g;
  }).length + (counts[`${teamId}:${g}`] ?? 0);

  const assigned: { athleteId: string; teamId: string; name: string }[] = [];
  const skipped: string[] = [];
  for (const a of todo.sort((x, y) => x.lastName.localeCompare(y.lastName))) {
    const g = gradeNumber(a.grade);
    let team = null as typeof orange | null;
    if (g === 6 || g === 7) team = white;
    else if (g === 3 || g === 4) {
      const o = count(orange.id, g), b = count(black.id, g);
      if (o !== b) team = o < b ? orange : black;
      else {
        // Tie within this grade: give it to the team with fewer players overall.
        const total = (t: typeof orange) => t.members.length + assigned.filter((x) => x.teamId === t.id).length;
        team = total(orange) <= total(black) ? orange : black;
      }
      counts[`${team.id}:${g}`] = (counts[`${team.id}:${g}`] ?? 0) + 1;
    }
    if (!team) { skipped.push(`${a.firstName} ${a.lastName} (grade ${a.grade ?? "?"})`); continue; }
    assigned.push({ athleteId: a.id, teamId: team.id, name: team.name });
  }

  for (const x of assigned) {
    await db.teamMember.create({ data: { teamId: x.teamId, athleteId: x.athleteId } });
  }
  return { assigned, skipped };
}
