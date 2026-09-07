import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuardianAthleteOrNull } from "@/lib/athlete-profile";
import { publishedReport, trendsFor } from "@/lib/progress";
import { quarterLabel } from "@/lib/quarters";
import { levelLabel, metricLabel } from "@/lib/progress-metrics";
import { displayName } from "@/lib/athlete";

// One quarterly report, as a parent reads it.
//
// The skill lines lead with the WORD, not the number — "Progressing" is the
// information; the 1-5 is only how it's stored. Nothing on this page compares
// the athlete to anyone else, because nothing in the data model could.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-orange">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { id, reportId } = await params;
  const athlete = await getGuardianAthleteOrNull(id);
  if (!athlete) notFound();

  const report = await publishedReport(athlete.id, reportId);
  if (!report) notFound();

  const trends = await trendsFor(athlete.id, report.sport);
  const clicking = report.skills.filter((s) => s.clicking);
  const participation = (report.participation ?? {}) as Record<string, number>;
  const name = displayName(athlete);

  return (
    <div className="flex flex-col gap-7">
      <div>
        <Link
          href={`/my-courts/athletes/${athlete.id}/progress`}
          className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark hover:text-orange"
        >
          &larr; All Reports
        </Link>
        <h1 className="mt-3 font-display text-[26px] leading-[1.05] font-black tracking-tight text-near-black">
          {quarterLabel(report)}
        </h1>
        <p className="mt-1 font-body text-[13.5px] text-gray-dark">
          {report.sport}
          {report.author?.name ? ` · ${report.author.name}` : ""}
        </p>
      </div>

      {report.coachTake && (
        <Section title="Coach's Take">
          <p className="font-body text-[15px] leading-relaxed text-near-black">
            {report.coachTake}
          </p>
        </Section>
      )}

      {clicking.length > 0 && (
        <Section title="What's Clicking">
          <ul className="flex flex-col divide-y divide-gray-mid overflow-hidden rounded-xl border border-gray-mid bg-white">
            {clicking.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-3 px-4 py-3.5">
                <span className="font-heading text-[14.5px] font-bold text-near-black">
                  {metricLabel(report.sport, s.metric)}
                </span>
                <span className="shrink-0 font-sport text-[11px] font-bold uppercase tracking-[0.12em] text-success">
                  {levelLabel(s.level)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {report.priorities.length > 0 && (
        <Section title="What We're Working On">
          <ul className="flex flex-col gap-2">
            {report.priorities.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-gray-mid bg-white px-4 py-3 font-body text-[15px] text-near-black"
              >
                {p.label}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {report.skills.length > 0 && (
        <Section title="Skill Snapshot">
          <ul className="flex flex-col divide-y divide-gray-mid overflow-hidden rounded-xl border border-gray-mid bg-white">
            {report.skills.map((s) => (
              <li key={s.id} className="px-4 py-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-body text-[14.5px] text-near-black">
                    {metricLabel(report.sport, s.metric)}
                  </span>
                  <span className="shrink-0 font-sport text-[11px] font-bold uppercase tracking-[0.12em] text-gray-dark">
                    {levelLabel(s.level)}
                  </span>
                </div>
                {s.comment && (
                  <p className="mt-1 font-body text-[13.5px] leading-snug text-gray-dark">
                    {s.comment}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {trends.length > 0 && (
        <Section title="Over Time">
          <div className="flex flex-col gap-4 rounded-xl border border-gray-mid bg-white p-4">
            {trends.map((t) => (
              <div key={t.metric}>
                <p className="mb-1.5 font-heading text-[14px] font-bold text-near-black">
                  {metricLabel(report.sport, t.metric)}
                </p>
                {/* Plain labelled steps. No fitted line and no chart: four
                    quarters do not support a curve, and drawing one would imply
                    a precision this data doesn't have. */}
                <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {t.points.map((p, i) => (
                    <li key={`${p.year}-${p.quarter}`} className="flex items-center gap-2">
                      {i > 0 && (
                        <span aria-hidden="true" className="font-body text-gray-dark">
                          &rarr;
                        </span>
                      )}
                      <span className="font-body text-[13px] text-gray-dark">
                        <span className="font-sport text-[10.5px] font-bold uppercase tracking-[0.1em]">
                          Q{p.quarter} {p.year}
                        </span>{" "}
                        {levelLabel(p.level)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </Section>
      )}

      {report.upNextFocus && (
        <Section title="Up Next">
          <div className="rounded-xl border border-gray-mid bg-white p-4">
            <p className="font-heading text-[15px] font-bold text-near-black">
              {report.upNextFocus}
            </p>
            {report.upNextProgramType && (
              <p className="mt-1.5 font-body text-[13.5px] text-gray-dark">
                Recommended: {report.upNextProgramType}
              </p>
            )}
            <Link
              href="/my-courts/explore"
              className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-orange px-5 font-sport text-[13px] font-bold uppercase tracking-wide text-white hover:bg-orange-hover"
            >
              Find Training
            </Link>
          </div>
        </Section>
      )}

      {Object.keys(participation).length > 0 && (
        <Section title="This Quarter">
          <ul className="flex flex-col divide-y divide-gray-mid overflow-hidden rounded-xl border border-gray-mid bg-white">
            {Object.entries(participation).map(([label, count]) => (
              <li key={label} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <span className="font-body text-[14px] text-near-black">{label}</span>
                <span className="font-body text-[14px] tabular-nums text-gray-dark">{count}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-body text-[12.5px] leading-snug text-gray-dark">
            Just context for {name}&rsquo;s quarter — attendance isn&rsquo;t a grade.
          </p>
        </Section>
      )}
    </div>
  );
}
