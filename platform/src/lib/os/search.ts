import "server-only";
import { prisma } from "@/lib/prisma";
import { can } from "./permissions";
import type { OsActor } from "./permissions";
import { athleteScope, familyScope, programScope, teamScope } from "./dal";

// Global search. Every branch is gated twice: by capability (may this role see
// coaches at all?) and by scope filter (may this head coach see THIS athlete?).
// Results a role may not see are never fetched, not merely hidden.

export type SearchHit = {
  type: "family" | "athlete" | "program" | "team" | "coach" | "lead";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

const PER_TYPE = 6;

export async function globalSearch(actor: OsActor, rawQuery: string): Promise<SearchHit[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];

  const contains = { contains: q, mode: "insensitive" as const };
  const hits: SearchHit[] = [];

  // --- Families (by family name, guardian name, email, phone) -------------
  if (can(actor, "families.view")) {
    const families = await prisma.family.findMany({
      where: {
        AND: [
          familyScope(actor),
          {
            OR: [
              { name: contains },
              { guardians: { some: { guardian: { name: contains } } } },
              { guardians: { some: { guardian: { email: contains } } } },
              { guardians: { some: { guardian: { phone: contains } } } },
            ],
          },
        ],
      },
      take: PER_TYPE,
      select: {
        id: true,
        name: true,
        athletes: { select: { firstName: true }, take: 4 },
        guardians: { select: { guardian: { select: { name: true } } }, take: 2 },
      },
    });
    for (const f of families) {
      const kids = f.athletes.map((a) => a.firstName).join(", ");
      const adults = f.guardians.map((g) => g.guardian.name).join(", ");
      hits.push({
        type: "family",
        id: f.id,
        title: f.name,
        subtitle: [adults, kids].filter(Boolean).join(" · ") || "No athletes yet",
        href: `/os/families/${f.id}`,
      });
    }
  }

  // --- Athletes (name, school-ish grade) ----------------------------------
  if (can(actor, "athletes.view")) {
    const athletes = await prisma.athlete.findMany({
      where: {
        AND: [
          athleteScope(actor),
          { OR: [{ firstName: contains }, { lastName: contains }] },
        ],
      },
      take: PER_TYPE,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        grade: true,
        family: { select: { name: true } },
      },
    });
    for (const a of athletes) {
      hits.push({
        type: "athlete",
        id: a.id,
        title: `${a.firstName} ${a.lastName}`,
        subtitle: [a.grade ? `${a.grade} grade` : null, a.family.name]
          .filter(Boolean)
          .join(" · "),
        href: `/os/athletes/${a.id}`,
      });
    }
  }

  // --- Programs -----------------------------------------------------------
  if (can(actor, "programs.view")) {
    const programs = await prisma.program.findMany({
      where: {
        AND: [
          programScope(actor),
          { OR: [{ name: contains }, { internalName: contains }] },
          { status: { not: "archived" } },
        ],
      },
      take: PER_TYPE,
      select: { id: true, name: true, sport: true, programType: true, status: true },
    });
    for (const p of programs) {
      hits.push({
        type: "program",
        id: p.id,
        title: p.name,
        subtitle: [p.sport, p.programType.replace("_", " "), p.status].filter(Boolean).join(" · "),
        href: `/os/programs/${p.id}`,
      });
    }
  }

  // --- Teams --------------------------------------------------------------
  if (can(actor, "leagues.view")) {
    const teams = await prisma.team.findMany({
      where: { AND: [teamScope(actor), { name: contains }] },
      take: PER_TYPE,
      select: {
        id: true,
        name: true,
        division: true,
        program: { select: { name: true } },
        _count: { select: { members: true } },
      },
    });
    for (const t of teams) {
      hits.push({
        type: "team",
        id: t.id,
        title: t.name,
        subtitle: `${t.program.name} · ${t._count.members} on roster`,
        href: `/os/teams/${t.id}`,
      });
    }
  }

  // --- Coaches ------------------------------------------------------------
  if (can(actor, "coaches.view")) {
    const coaches = await prisma.staffUser.findMany({
      where: { OR: [{ name: contains }, { email: contains }] },
      take: PER_TYPE,
      select: { id: true, name: true, role: true, sports: true, active: true },
    });
    for (const c of coaches) {
      hits.push({
        type: "coach",
        id: c.id,
        title: c.name,
        subtitle: [c.role.replace("_", " "), c.sports.join("/"), c.active ? null : "Inactive"]
          .filter(Boolean)
          .join(" · "),
        href: `/os/coaches/${c.id}`,
      });
    }
  }

  // --- Leads --------------------------------------------------------------
  if (can(actor, "leads.view")) {
    const leads = await prisma.lead.findMany({
      where: { OR: [{ name: contains }, { email: contains }, { phone: contains }] },
      take: PER_TYPE,
      select: { id: true, name: true, stage: true, source: true },
    });
    for (const l of leads) {
      hits.push({
        type: "lead",
        id: l.id,
        title: l.name,
        subtitle: `Lead · ${l.stage.replace("_", " ")} · ${l.source.replace("_", " ")}`,
        href: `/os/leads/${l.id}`,
      });
    }
  }

  return hits;
}
