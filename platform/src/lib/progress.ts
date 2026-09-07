import "server-only";
import { prisma } from "@/lib/prisma";
import { quarterRange, type Quarter } from "@/lib/quarters";
import { minSessionsForReport } from "@/lib/progress-metrics";
import type { Prisma } from "@/generated/prisma/client";

// Queries behind the Progress tab and the Coach App's report workflow.
//
// The parent-facing readers below filter on status: "published" in the DATABASE
// QUERY, not after fetching. A draft is a coach thinking out loud; it must not
// be one forgotten `.filter()` away from a parent's screen.

export const reportInclude = {
  skills: { orderBy: { sortOrder: "asc" } },
  priorities: { orderBy: { sortOrder: "asc" } },
  author: { select: { id: true, name: true, title: true } },
} satisfies Prisma.ProgressReportInclude;

export type ProgressReportDetail = Prisma.ProgressReportGetPayload<{
  include: typeof reportInclude;
}>;

/// Published reports only, newest first. The parent's whole history.
export async function publishedReportsFor(athleteId: string): Promise<ProgressReportDetail[]> {
  return prisma.progressReport.findMany({
    where: { athleteId, status: "published" },
    include: reportInclude,
    orderBy: [{ year: "desc" }, { quarter: "desc" }],
  });
}

export async function publishedReport(
  athleteId: string,
  reportId: string
): Promise<ProgressReportDetail | null> {
  // Scoped by athleteId as well as id: a published report belonging to another
  // family cannot be opened by guessing its id.
  return prisma.progressReport.findFirst({
    where: { id: reportId, athleteId, status: "published" },
    include: reportInclude,
  });
}

/// One metric's history across this athlete's own published reports. The only
/// comparison the product makes.
export async function metricTrend(athleteId: string, sport: string, metric: string) {
  const rows = await prisma.progressSkill.findMany({
    where: {
      metric,
      report: { athleteId, sport, status: "published" },
    },
    include: { report: { select: { year: true, quarter: true } } },
  });
  return rows.map((r) => ({ year: r.report.year, quarter: r.report.quarter, level: r.level }));
}

/// Every metric with more than one published data point, for the trend block.
export async function trendsFor(athleteId: string, sport: string) {
  const rows = await prisma.progressSkill.findMany({
    where: { report: { athleteId, sport, status: "published" } },
    include: { report: { select: { year: true, quarter: true } } },
  });

  const byMetric = new Map<string, { year: number; quarter: number; level: number }[]>();
  for (const row of rows) {
    const list = byMetric.get(row.metric) ?? [];
    list.push({ year: row.report.year, quarter: row.report.quarter, level: row.level });
    byMetric.set(row.metric, list);
  }

  return [...byMetric.entries()]
    .filter(([, points]) => points.length > 1)
    .map(([metric, points]) => ({
      metric,
      points: points.sort((a, b) => a.year - b.year || a.quarter - b.quarter),
    }));
}

// ---------------------------------------------------------------------------
// Participation
//
// Context for a report, never a grade. Counted from attendance that was
// actually recorded — "present" and "late" both mean the athlete was in the
// building; an unrecorded session counts for nothing rather than being assumed.
// ---------------------------------------------------------------------------

export async function participationFor(athleteId: string, q: Quarter) {
  const { start, end } = quarterRange(q);

  const attended = await prisma.attendanceRecord.findMany({
    where: {
      status: { in: ["present", "late"] },
      booking: {
        athleteId,
        session: { startTime: { gte: start, lt: end } },
      },
    },
    include: {
      booking: {
        include: { session: { include: { program: { select: { programType: true, name: true } } } } },
      },
    },
  });

  const counts: Record<string, number> = {};
  for (const record of attended) {
    const type = record.booking.session.program.programType;
    const label = PROGRAM_TYPE_LABELS[type] ?? "Sessions";
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return { counts, total: attended.length };
}

const PROGRAM_TYPE_LABELS: Record<string, string> = {
  class: "Group Training Sessions",
  camp: "Camp",
  league: "League Sessions",
  private: "Private Sessions",
  event: "Events",
  rental: "Court Time",
  resource: "Dr. Dish Sessions",
};

/**
 * Whether this athlete has had enough court time with us this quarter for a
 * report to mean anything. Below the threshold the Coach App and Courts OS show
 * "Not enough court time yet" instead of inviting a coach to invent a score.
 */
export async function participationEligibility(athleteId: string, q: Quarter) {
  const { total } = await participationFor(athleteId, q);
  const minimum = minSessionsForReport();
  return { sessions: total, minimum, eligible: total >= minimum };
}
