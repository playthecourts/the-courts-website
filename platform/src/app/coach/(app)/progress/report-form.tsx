"use client";

import { useState } from "react";
import { saveProgressReport } from "./actions";
import { DEVELOPMENT_SCALE } from "@/lib/progress-metrics";

// The compose screen. Target: a coach finishes one in 2-3 minutes on a phone.
//
// That target drives the shape. Skill levels are five taps, not five text
// boxes. Nothing requires a comment. Priorities are three short lines. The only
// writing asked for is the Coach's Take, and it says "a couple of sentences"
// because a coach who thinks an essay is expected writes nothing at all.

type Metric = { key: string; label: string };

export default function ReportForm({
  athleteId,
  reportId,
  sport,
  year,
  quarter,
  metrics,
  athleteGoal,
  coachingStyle,
  initial,
}: {
  athleteId: string;
  reportId?: string;
  sport: string;
  year: number;
  quarter: number;
  metrics: Metric[];
  athleteGoal: string | null;
  coachingStyle: string[];
  initial?: {
    coachTake: string | null;
    upNextFocus: string | null;
    upNextProgramType: string | null;
    skills: { metric: string; level: number; clicking: boolean; comment: string | null }[];
    priorities: string[];
  };
}) {
  const [levels, setLevels] = useState<Record<string, number>>(
    Object.fromEntries((initial?.skills ?? []).map((s) => [s.metric, s.level]))
  );

  const rated = metrics.filter((m) => levels[m.key]);

  return (
    <form action={saveProgressReport}>
      <input type="hidden" name="athleteId" value={athleteId} />
      {reportId && <input type="hidden" name="reportId" value={reportId} />}
      <input type="hidden" name="sport" value={sport} />
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="quarter" value={quarter} />

      {/* The athlete's own words, in front of the coach while they write.
          Context — explicitly not a metric and not scored. */}
      {(athleteGoal || coachingStyle.length > 0) && (
        <div className="mb-5 rounded-xl border border-gray-mid bg-warm-stone/60 px-4 py-3.5">
          {athleteGoal && (
            <div className="mb-2.5">
              <p className="font-sport text-[10px] font-bold uppercase tracking-[0.14em] text-gray-dark">
                Athlete Goal
              </p>
              <p className="mt-0.5 font-body text-sm text-near-black">{athleteGoal}</p>
            </div>
          )}
          {coachingStyle.length > 0 && (
            <div>
              <p className="font-sport text-[10px] font-bold uppercase tracking-[0.14em] text-gray-dark">
                Coaching Style
              </p>
              <p className="mt-0.5 font-body text-sm text-near-black">{coachingStyle.join(" · ")}</p>
            </div>
          )}
        </div>
      )}

      <section className="mb-6">
        <h2 className="mb-2 font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-gray-dark">
          Skill Snapshot
        </h2>
        <p className="mb-3 font-body text-[13px] text-gray-dark">
          Rate only what you&rsquo;ve actually seen. Skipping one is fine.
        </p>

        <div className="flex flex-col gap-3">
          {metrics.map((m) => {
            const level = levels[m.key];
            return (
              <div key={m.key} className="rounded-xl border border-gray-mid bg-white px-3.5 py-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="font-heading text-sm font-bold text-near-black">{m.label}</span>
                  {level && (
                    <span className="font-sport text-[10px] font-bold uppercase tracking-[0.1em] text-orange">
                      {DEVELOPMENT_SCALE.find((s) => s.level === level)?.label}
                    </span>
                  )}
                </div>

                <div className="flex gap-1.5">
                  {DEVELOPMENT_SCALE.map((s) => (
                    <label key={s.level} className="flex-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`level:${m.key}`}
                        value={s.level}
                        checked={level === s.level}
                        onChange={() => setLevels({ ...levels, [m.key]: s.level })}
                        className="peer sr-only"
                      />
                      <span className="flex min-h-[42px] items-center justify-center rounded-lg border border-gray-mid bg-white font-body text-[13px] text-gray-dark transition-colors peer-checked:border-orange peer-checked:bg-orange peer-checked:text-white">
                        {s.level}
                      </span>
                    </label>
                  ))}
                </div>

                {level && (
                  <div className="mt-2.5 flex flex-col gap-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        name="clicking"
                        value={m.key}
                        defaultChecked={initial?.skills.find((s) => s.metric === m.key)?.clicking}
                        className="h-4 w-4 accent-[var(--color-orange)]"
                      />
                      <span className="font-body text-[13px] text-near-black">
                        Show under &ldquo;What&rsquo;s Clicking&rdquo;
                      </span>
                    </label>
                    <input
                      name={`comment:${m.key}`}
                      defaultValue={initial?.skills.find((s) => s.metric === m.key)?.comment ?? ""}
                      placeholder="Optional note"
                      className="w-full rounded-lg border border-gray-mid px-3 py-2 font-body text-[15px] text-near-black placeholder:text-gray-dark/60 focus:border-orange focus:outline-none"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 font-body text-[12.5px] text-gray-dark">
          {rated.length} of {metrics.length} rated · {DEVELOPMENT_SCALE[0].label} →{" "}
          {DEVELOPMENT_SCALE[4].label}
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-gray-dark">
          What We&rsquo;re Working On
        </h2>
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              name="priority"
              defaultValue={initial?.priorities[i] ?? ""}
              placeholder={i === 0 ? "Finishing with left hand" : "Optional"}
              className="w-full rounded-lg border border-gray-mid px-3.5 py-2.5 font-body text-[15px] text-near-black placeholder:text-gray-dark/60 focus:border-orange focus:outline-none"
            />
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-gray-dark">
          Coach&rsquo;s Take
        </h2>
        <textarea
          name="coachTake"
          rows={4}
          defaultValue={initial?.coachTake ?? ""}
          placeholder="A couple of sentences in your own words — what changed this quarter?"
          className="w-full rounded-lg border border-gray-mid px-3.5 py-2.5 font-body text-[15px] text-near-black placeholder:text-gray-dark/60 focus:border-orange focus:outline-none"
        />
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-sport text-[11px] font-bold uppercase tracking-[0.14em] text-gray-dark">
          Up Next
        </h2>
        <div className="flex flex-col gap-2">
          <input
            name="upNextFocus"
            defaultValue={initial?.upNextFocus ?? ""}
            placeholder="Left-hand finishing + footwork"
            className="w-full rounded-lg border border-gray-mid px-3.5 py-2.5 font-body text-[15px] text-near-black placeholder:text-gray-dark/60 focus:border-orange focus:outline-none"
          />
          {/* Optional on purpose. A coach is never required to attach a
              commercial recommendation in order to finish a report. */}
          <input
            name="upNextProgramType"
            defaultValue={initial?.upNextProgramType ?? ""}
            placeholder="Recommended program type (optional)"
            className="w-full rounded-lg border border-gray-mid px-3.5 py-2.5 font-body text-[15px] text-near-black placeholder:text-gray-dark/60 focus:border-orange focus:outline-none"
          />
        </div>
      </section>

      <div className="flex flex-col gap-2 pb-4">
        <button
          type="submit"
          name="intent"
          value="submit"
          className="min-h-[52px] w-full rounded-lg bg-orange px-5 font-sport text-[15px] font-bold uppercase tracking-wide text-white hover:bg-orange-hover"
        >
          Submit for Review
        </button>
        <button
          type="submit"
          name="intent"
          value="draft"
          className="min-h-[48px] w-full rounded-lg border border-gray-mid bg-white px-5 font-sport text-[14px] font-bold uppercase tracking-wide text-gray-dark hover:border-gray-dark hover:text-near-black"
        >
          Save Draft
        </button>
      </div>
    </form>
  );
}
