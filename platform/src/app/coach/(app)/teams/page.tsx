import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentCoach, teamScope, programScope, isLeadership } from "@/lib/coach-dal";
import { Card, PageTitle, EmptyState, SectionHeading, Pill, ActionLink } from "@/components/coach/ui";

export const dynamic = "force-dynamic";

// The League Hub, and the fallback for coaches who don't have league teams.
// Rather than showing an empty "Teams" tab to a group-training coach, the same
// route lists the training groups they actually run.
export default async function CoachTeamsPage() {
  const actor = await getCurrentCoach();

  const teams = await prisma.team.findMany({
    where: teamScope(actor),
    orderBy: [{ program: { name: "asc" } }, { name: "asc" }],
    include: {
      program: true,
      coaches: { include: { staff: { select: { name: true } } } },
      _count: { select: { members: true } },
    },
  });

  // Non-league programs the coach actually works — their "groups".
  const groups = await prisma.program.findMany({
    where: {
      AND: [
        programScope(actor),
        { active: true },
        { programType: { in: ["class", "camp", "private", "event"] } },
      ],
    },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { sessions: { where: { status: "scheduled", startTime: { gte: new Date() } } } } },
    },
  });

  // Group teams under their league program, so a season reads as a season.
  const byProgram = new Map<string, typeof teams>();
  for (const t of teams) {
    byProgram.set(t.programId, [...(byProgram.get(t.programId) ?? []), t]);
  }

  const hasAnything = teams.length > 0 || groups.length > 0;

  return (
    <div>
      <PageTitle eyebrow={teams.length > 0 ? "League Hub" : "Your Groups"}>
        {teams.length > 0 ? "Teams" : "Groups"}
      </PageTitle>

      {!hasAnything && (
        <EmptyState
          title="No Team Assigned."
          body="Your league assignments will show here once a head coach adds you to a team."
        />
      )}

      {[...byProgram.entries()].map(([programId, programTeams]) => {
        const program = programTeams[0].program;
        return (
          <section key={programId} className="mb-6">
            <SectionHeading>{program.name}</SectionHeading>
            <Card>
              {programTeams.map((t) => (
                <Link
                  key={t.id}
                  href={`/coach/teams/${t.id}`}
                  className="flex min-h-[64px] items-center gap-3 border-b border-gray-mid px-4 py-2.5 last:border-b-0 hover:bg-warm-stone/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-orange"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-heading text-[15px] font-bold text-near-black">
                      {t.name}
                    </span>
                    <span className="block truncate font-body text-xs text-gray-dark">
                      {[t.division, t.coaches.map((c) => c.staff.name).join(", ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <Pill>{t._count.members} Players</Pill>
                </Link>
              ))}
            </Card>
            {isLeadership(actor) && (
              <div className="mt-2">
                <ActionLink href={`/coach/teams/build/${programId}`} variant="secondary">
                  Team Placement
                </ActionLink>
              </div>
            )}
          </section>
        );
      })}

      {groups.length > 0 && (
        <section className="mb-6">
          <SectionHeading>{teams.length > 0 ? "Training Groups" : "Your Groups"}</SectionHeading>
          <Card>
            {groups.map((g) => (
              <Link
                key={g.id}
                href={`/coach/schedule?scope=mine`}
                className="flex min-h-[60px] items-center gap-3 border-b border-gray-mid px-4 py-2.5 last:border-b-0 hover:bg-warm-stone/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-heading text-[15px] font-bold text-near-black">
                    {g.name}
                  </span>
                  <span className="block font-body text-xs text-gray-dark">
                    {[g.sport, g.programType].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <Pill>{g._count.sessions} Upcoming</Pill>
              </Link>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
