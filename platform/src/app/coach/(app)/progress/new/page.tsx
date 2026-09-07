import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentCoach, assertAthleteAccess } from "@/lib/coach-dal";
import { BackLink, PageTitle, Card } from "@/components/coach/ui";
import { displayName, coachingPreferenceLabels } from "@/lib/athlete";
import { metricsForSport } from "@/lib/progress-metrics";
import { reportingQuarter, quarterLabel } from "@/lib/quarters";
import { participationEligibility } from "@/lib/progress";
import ReportForm from "../report-form";

export const dynamic = "force-dynamic";

export default async function NewProgressReportPage(props: {
  searchParams: Promise<{ athleteId?: string; sport?: string }>;
}) {
  const actor = await getCurrentCoach();
  const { athleteId, sport: sportParam } = await props.searchParams;
  if (!athleteId) redirect("/coach/athletes");

  await assertAthleteAccess(actor, athleteId);

  const athlete = await prisma.athlete.findUniqueOrThrow({
    where: { id: athleteId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nickname: true,
      sports: true,
      goal: true,
      coachingPreferences: true,
    },
  });

  const sport = sportParam ?? athlete.sports[0] ?? "Basketball";
  const q = reportingQuarter();

  const [existing, eligibility] = await Promise.all([
    prisma.progressReport.findUnique({
      where: {
        athleteId_sport_year_quarter: {
          athleteId: athlete.id,
          sport,
          year: q.year,
          quarter: q.quarter,
        },
      },
      include: { skills: true, priorities: { orderBy: { sortOrder: "asc" } } },
    }),
    participationEligibility(athlete.id, q),
  ]);

  // An existing draft for this quarter is the same report — open it rather
  // than starting a second one.
  if (existing) redirect(`/coach/progress/${existing.id}`);

  const name = displayName(athlete);

  return (
    <div>
      <BackLink href={`/coach/athletes/${athlete.id}`}>{name}</BackLink>
      <PageTitle eyebrow={quarterLabel(q)} sub={`${sport} · Progress Report`}>
        {name}
      </PageTitle>

      {!eligibility.eligible ? (
        // Internal-only state. No half-report gets written, and no score is
        // invented for a child the coach hasn't had enough time with.
        <Card className="px-4 py-5">
          <p className="font-heading text-[15px] font-bold text-near-black">
            Not Enough Court Time Yet
          </p>
          <p className="mt-1.5 font-body text-sm leading-relaxed text-gray-dark">
            {name} has {eligibility.sessions} recorded session
            {eligibility.sessions === 1 ? "" : "s"} this quarter. We write reports at{" "}
            {eligibility.minimum} or more, so there&rsquo;s something real to say.
          </p>
          <p className="mt-2 font-body text-[12.5px] text-gray-dark">
            Nothing is shown to the family about this.
          </p>
        </Card>
      ) : (
        <ReportForm
          athleteId={athlete.id}
          sport={sport}
          year={q.year}
          quarter={q.quarter}
          metrics={metricsForSport(sport)}
          athleteGoal={athlete.goal}
          coachingStyle={coachingPreferenceLabels(athlete.coachingPreferences)}
        />
      )}
    </div>
  );
}
