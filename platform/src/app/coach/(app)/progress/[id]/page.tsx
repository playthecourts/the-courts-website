import { prisma } from "@/lib/prisma";
import { getCurrentCoach, assertAthleteAccess, isLeadership, canManageSport } from "@/lib/coach-dal";
import { BackLink, PageTitle, Card, Pill, SectionHeading } from "@/components/coach/ui";
import { displayName, coachingPreferenceLabels } from "@/lib/athlete";
import { metricsForSport, metricLabel, levelLabel } from "@/lib/progress-metrics";
import { quarterLabel } from "@/lib/quarters";
import ReportForm from "../report-form";
import { publishProgressReport, returnProgressReport } from "../actions";

export const dynamic = "force-dynamic";

const STATUS_LABELS = {
  draft: "Draft",
  ready_for_review: "Awaiting Review",
  published: "Published",
} as const;

export default async function ProgressReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await getCurrentCoach();
  const { id } = await params;

  const report = await prisma.progressReport.findUniqueOrThrow({
    where: { id },
    include: {
      skills: { orderBy: { sortOrder: "asc" } },
      priorities: { orderBy: { sortOrder: "asc" } },
      athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          nickname: true,
          goal: true,
          coachingPreferences: true,
        },
      },
      author: { select: { name: true } },
    },
  });

  // Same gate as everywhere else in the Coach App — the report id alone is
  // never enough to open someone else's athlete.
  await assertAthleteAccess(actor, report.athleteId);

  const name = displayName(report.athlete);
  const canReview = isLeadership(actor) && canManageSport(actor, report.sport);
  const editable = report.status !== "published";

  return (
    <div>
      <BackLink href={`/coach/athletes/${report.athleteId}`}>{name}</BackLink>
      <PageTitle eyebrow={quarterLabel(report)} sub={`${report.sport} · ${report.author.name}`}>
        {name}
      </PageTitle>

      <div className="mb-4">
        <Pill tone={report.status === "published" ? "ok" : report.status === "ready_for_review" ? "accent" : "neutral"}>
          {STATUS_LABELS[report.status]}
        </Pill>
      </div>

      {report.status === "published" ? (
        <>
          <Card className="mb-4 px-4 py-4">
            {report.coachTake && (
              <p className="font-body text-sm leading-relaxed text-near-black">{report.coachTake}</p>
            )}
          </Card>

          <section className="mb-4">
            <SectionHeading>Skill Snapshot</SectionHeading>
            <Card>
              {report.skills.map((s) => (
                <div
                  key={s.id}
                  className="flex min-h-[44px] items-center justify-between gap-3 border-b border-gray-mid px-4 py-2.5 last:border-b-0"
                >
                  <span className="font-body text-sm text-near-black">
                    {metricLabel(report.sport, s.metric)}
                  </span>
                  <span className="font-sport text-[10px] font-bold uppercase tracking-[0.1em] text-gray-dark">
                    {levelLabel(s.level)}
                  </span>
                </div>
              ))}
            </Card>
          </section>

          <p className="pb-4 font-body text-[12.5px] text-gray-dark">
            Published reports are visible to the family and can&rsquo;t be edited here.
          </p>
        </>
      ) : (
        <>
          {canReview && report.status === "ready_for_review" && (
            <Card className="mb-5 px-4 py-4">
              <p className="mb-1 font-heading text-sm font-bold text-near-black">
                Ready for your review
              </p>
              <p className="mb-3 font-body text-[13px] text-gray-dark">
                Publishing makes this visible to {name}&rsquo;s family.
              </p>
              <div className="flex flex-col gap-2">
                <form action={publishProgressReport.bind(null, report.id)}>
                  <button
                    type="submit"
                    className="min-h-[48px] w-full rounded-lg bg-orange px-5 font-sport text-[14px] font-bold uppercase tracking-wide text-white hover:bg-orange-hover"
                  >
                    Publish to Parent
                  </button>
                </form>
                <form action={returnProgressReport.bind(null, report.id)}>
                  <button
                    type="submit"
                    className="min-h-[46px] w-full rounded-lg border border-gray-mid bg-white px-5 font-sport text-[13px] font-bold uppercase tracking-wide text-gray-dark hover:border-gray-dark hover:text-near-black"
                  >
                    Return to Coach
                  </button>
                </form>
              </div>
            </Card>
          )}

          {editable && (
            <ReportForm
              athleteId={report.athleteId}
              reportId={report.id}
              sport={report.sport}
              year={report.year}
              quarter={report.quarter}
              metrics={metricsForSport(report.sport)}
              athleteGoal={report.athlete.goal}
              coachingStyle={coachingPreferenceLabels(report.athlete.coachingPreferences)}
              initial={{
                coachTake: report.coachTake,
                upNextFocus: report.upNextFocus,
                upNextProgramType: report.upNextProgramType,
                skills: report.skills.map((s) => ({
                  metric: s.metric,
                  level: s.level,
                  clicking: s.clicking,
                  comment: s.comment,
                })),
                priorities: report.priorities.map((p) => p.label),
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
