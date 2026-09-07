// The development vocabulary for progress reports.
//
// Two deliberate absences shape this file:
//
//   1. No grades and no "average". The scale runs Building → Advanced, all five
//      of which describe a stage of development rather than a verdict on a
//      child. A parent reading "Developing" should hear where their kid is, not
//      how they placed.
//
//   2. No cross-athlete anything. There is no percentile, no rank and no team
//      average in this module because there is nowhere in the product they
//      would be allowed to appear. An athlete is compared to their own previous
//      quarters, which is what trendFor() below does.

export const DEVELOPMENT_SCALE: { level: number; label: string; blurb: string }[] = [
  { level: 1, label: "Building", blurb: "Just starting to learn the skill" },
  { level: 2, label: "Developing", blurb: "Getting it in drills" },
  { level: 3, label: "Progressing", blurb: "Starting to show up in live play" },
  { level: 4, label: "Strong", blurb: "Reliable in games" },
  { level: 5, label: "Advanced", blurb: "A real strength to build around" },
];

export function levelLabel(level: number | null | undefined): string | null {
  if (!level) return null;
  return DEVELOPMENT_SCALE.find((s) => s.level === level)?.label ?? null;
}

/// Sport-specific categories. Volleyball is never scored on basketball
/// categories — that's the reason this is a map rather than one shared list.
export const SPORT_METRICS: Record<string, { key: string; label: string }[]> = {
  Basketball: [
    { key: "ball_handling", label: "Ball Handling" },
    { key: "shooting", label: "Shooting" },
    { key: "finishing", label: "Finishing" },
    { key: "passing_decisions", label: "Passing / Decision Making" },
    { key: "defense_movement", label: "Defense / Movement" },
    { key: "game_awareness", label: "Game Awareness" },
    { key: "confidence", label: "Confidence / Competitiveness" },
  ],
  Volleyball: [
    { key: "serving", label: "Serving" },
    { key: "passing", label: "Passing" },
    { key: "setting", label: "Setting" },
    { key: "hitting", label: "Hitting" },
    { key: "defense_movement", label: "Defense / Movement" },
    { key: "game_awareness", label: "Game Awareness" },
    { key: "communication", label: "Communication / Confidence" },
  ],
};

export function metricsForSport(sport: string | null | undefined) {
  if (!sport) return SPORT_METRICS.Basketball;
  return SPORT_METRICS[sport] ?? SPORT_METRICS.Basketball;
}

export function metricLabel(sport: string | null | undefined, key: string): string {
  return metricsForSport(sport).find((m) => m.key === key)?.label ?? key;
}

/// How many coach-led sessions an athlete needs in the quarter before a report
/// is worth writing. Configurable rather than hard-coded into the query,
/// because "enough court time to have an opinion" is a judgement that will get
/// tuned — and writing a report for a child a coach barely knows produces a
/// meaningless score, which is worse than no report.
export const DEFAULT_MIN_SESSIONS_FOR_REPORT = 4;

export function minSessionsForReport(): number {
  const raw = process.env.PROGRESS_MIN_SESSIONS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MIN_SESSIONS_FOR_REPORT;
}

export type TrendPoint = { year: number; quarter: number; level: number };

/// An athlete's own history on one metric, oldest first. Used to render the
/// simple Q-to-Q progression — no smoothing, no projection, no fitted line:
/// four data points do not support a curve, and drawing one would imply a
/// precision this data does not have.
export function trendFor(
  points: TrendPoint[]
): { year: number; quarter: number; level: number; label: string }[] {
  return [...points]
    .sort((a, b) => a.year - b.year || a.quarter - b.quarter)
    .map((p) => ({ ...p, label: levelLabel(p.level) ?? "" }));
}
