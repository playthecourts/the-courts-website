import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuardianAthleteOrNull } from "@/lib/athlete-profile";
import { publishedReportsFor } from "@/lib/progress";
import { quarterLabel } from "@/lib/quarters";
import { displayName } from "@/lib/athlete";

// The Progress tab: what all the reps are actually doing.
//
// Most recent first, past quarters kept. If nothing has been published yet the
// empty state explains WHY rather than showing a zero — a family who joined
// three weeks ago hasn't been forgotten, they just haven't had a quarter yet.

export default async function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const athlete = await getGuardianAthleteOrNull(id);
  if (!athlete) notFound();

  const reports = await publishedReportsFor(athlete.id);
  const name = displayName(athlete);

  if (reports.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-mid bg-white p-6 text-center">
        <p className="font-heading text-[16px] font-bold text-near-black">
          No progress reports yet
        </p>
        <p className="mx-auto mt-2 max-w-[42ch] font-body text-[13.5px] leading-relaxed text-gray-dark">
          Coaches add progress notes once they&rsquo;ve had enough time on the court with {name} to
          share something useful. We&rsquo;ll let you know when the first one is ready.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {reports.map((report) => {
        const clicking = report.skills.filter((s) => s.clicking);
        return (
          <li key={report.id}>
            <Link
              href={`/my-courts/athletes/${athlete.id}/progress/${report.id}`}
              className="block rounded-xl border border-gray-mid bg-white p-4 hover:border-orange"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-display text-[18px] font-black tracking-tight text-near-black">
                  {quarterLabel(report)}
                </p>
                <p className="font-sport text-[11px] font-bold uppercase tracking-[0.12em] text-gray-dark">
                  {report.sport}
                </p>
              </div>
              {report.coachTake && (
                <p className="mt-2 line-clamp-2 font-body text-[14px] leading-snug text-gray-dark">
                  {report.coachTake}
                </p>
              )}
              {clicking.length > 0 && (
                <p className="mt-2 font-body text-[13px] text-gray-dark">
                  {clicking.length} thing{clicking.length === 1 ? "" : "s"} clicking ·{" "}
                  {report.priorities.length} we&rsquo;re working on
                </p>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
