"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getCurrentCoach,
  assertAthleteAccess,
  isLeadership,
  canManageSport,
  type CoachActor,
} from "@/lib/coach-dal";
import { auditLog } from "@/lib/audit";
import { participationFor, participationEligibility } from "@/lib/progress";
import { reportingQuarter, type Quarter } from "@/lib/quarters";
import { metricsForSport } from "@/lib/progress-metrics";

// ---------------------------------------------------------------------------
// The progress report workflow.
//
//   coach writes  →  head of sport reviews  →  parent report publishes
//
// Two guards run on every action, because a server action is its own endpoint:
// assertAthleteAccess (may this coach touch this athlete at all) and, for the
// review/publish steps, a leadership check for the athlete's sport. A coach
// cannot publish their own report to a family by replaying the publish action.
// ---------------------------------------------------------------------------

async function loadReportForActor(actor: CoachActor, reportId: string) {
  const report = await prisma.progressReport.findUnique({
    where: { id: reportId },
    select: { id: true, athleteId: true, sport: true, status: true, authorStaffId: true },
  });
  if (!report) redirect("/coach/no-access");
  await assertAthleteAccess(actor, report.athleteId);
  return report;
}

function parseLevel(raw: FormDataEntryValue | null): number | null {
  const n = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

/**
 * Creates or updates the draft. Called by both Save Draft and Submit, because
 * they differ only in the status they leave behind — a coach interrupted
 * mid-report loses nothing either way.
 */
export async function saveProgressReport(formData: FormData) {
  const actor = await getCurrentCoach();

  const athleteId = String(formData.get("athleteId") ?? "");
  const reportId = String(formData.get("reportId") ?? "");
  const sport = String(formData.get("sport") ?? "Basketball");
  const submit = String(formData.get("intent") ?? "draft") === "submit";

  await assertAthleteAccess(actor, athleteId);

  const q: Quarter = {
    year: Number.parseInt(String(formData.get("year") ?? ""), 10) || reportingQuarter().year,
    quarter: Number.parseInt(String(formData.get("quarter") ?? ""), 10) || reportingQuarter().quarter,
  };

  const coachTake = String(formData.get("coachTake") ?? "").trim() || null;
  const upNextFocus = String(formData.get("upNextFocus") ?? "").trim() || null;
  const upNextProgramType = String(formData.get("upNextProgramType") ?? "").trim() || null;

  const priorities = formData
    .getAll("priority")
    .map((p) => String(p).trim())
    .filter(Boolean)
    .slice(0, 3);

  // Only metrics the coach actually rated are written. A report is allowed to
  // cover three skills — there is no requirement to score every category, and
  // padding one out with guesses is exactly what this avoids.
  const clicking = new Set(formData.getAll("clicking").map((v) => String(v)));
  const skills = metricsForSport(sport)
    .map((metric, index) => {
      const level = parseLevel(formData.get(`level:${metric.key}`));
      if (level === null) return null;
      return {
        metric: metric.key,
        level,
        clicking: clicking.has(metric.key),
        comment: String(formData.get(`comment:${metric.key}`) ?? "").trim() || null,
        sortOrder: index,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const status = submit ? "ready_for_review" : "draft";

  const report = await prisma.$transaction(async (tx) => {
    const saved = reportId
      ? await tx.progressReport.update({
          where: { id: reportId },
          data: { coachTake, upNextFocus, upNextProgramType, status },
        })
      : await tx.progressReport.upsert({
          // One report per athlete/sport/quarter — a coach who starts a second
          // one for the same quarter is editing the first, not forking it.
          where: {
            athleteId_sport_year_quarter: {
              athleteId,
              sport,
              year: q.year,
              quarter: q.quarter,
            },
          },
          create: {
            athleteId,
            sport,
            year: q.year,
            quarter: q.quarter,
            status,
            coachTake,
            upNextFocus,
            upNextProgramType,
            authorStaffId: actor.id,
          },
          update: { coachTake, upNextFocus, upNextProgramType, status },
        });

    // Replace rather than merge: the form posts the full picture every time, so
    // an unchecked skill genuinely means "not rated this quarter".
    await tx.progressSkill.deleteMany({ where: { reportId: saved.id } });
    if (skills.length > 0) {
      await tx.progressSkill.createMany({
        data: skills.map((s) => ({ ...s, reportId: saved.id })),
      });
    }

    await tx.progressPriority.deleteMany({ where: { reportId: saved.id } });
    if (priorities.length > 0) {
      await tx.progressPriority.createMany({
        data: priorities.map((label, i) => ({ reportId: saved.id, label, sortOrder: i })),
      });
    }

    return saved;
  });

  await auditLog(actor.id, submit ? "submit_progress_report" : "save_progress_report", "progress_report", report.id, {
    athleteId,
    quarter: `${q.year}Q${q.quarter}`,
  });

  revalidatePath(`/coach/athletes/${athleteId}`);
  revalidatePath("/coach/progress");
  redirect(`/coach/progress/${report.id}`);
}

/**
 * Publishing is the moment a family can read it, so it is leadership-only and
 * sport-scoped: a Head of Basketball cannot publish a volleyball report.
 * Participation is snapshotted here rather than computed at read time — a later
 * cancellation must not silently rewrite a published report.
 */
export async function publishProgressReport(reportId: string) {
  const actor = await getCurrentCoach();
  const report = await loadReportForActor(actor, reportId);

  if (!isLeadership(actor) || !canManageSport(actor, report.sport)) {
    redirect("/coach/no-access");
  }

  const { counts } = await participationFor(report.athleteId, await quarterOf(reportId));

  await prisma.progressReport.update({
    where: { id: reportId },
    data: {
      status: "published",
      publishedAt: new Date(),
      reviewedByStaffId: actor.id,
      participation: counts,
    },
  });

  await auditLog(actor.id, "publish_progress_report", "progress_report", reportId, {
    athleteId: report.athleteId,
  });

  revalidatePath(`/coach/progress/${reportId}`);
  revalidatePath(`/my-courts/athletes/${report.athleteId}/progress`);
}

/** Sends it back with the draft intact — nothing the coach wrote is discarded. */
export async function returnProgressReport(reportId: string) {
  const actor = await getCurrentCoach();
  const report = await loadReportForActor(actor, reportId);

  if (!isLeadership(actor) || !canManageSport(actor, report.sport)) {
    redirect("/coach/no-access");
  }

  await prisma.progressReport.update({ where: { id: reportId }, data: { status: "draft" } });
  await auditLog(actor.id, "return_progress_report", "progress_report", reportId, {
    athleteId: report.athleteId,
  });
  revalidatePath(`/coach/progress/${reportId}`);
}

async function quarterOf(reportId: string): Promise<Quarter> {
  const r = await prisma.progressReport.findUniqueOrThrow({
    where: { id: reportId },
    select: { year: true, quarter: true },
  });
  return { year: r.year, quarter: r.quarter };
}

/// Used by the compose screen to show "not enough court time yet" instead of
/// inviting a coach to score a child they've barely met.
export async function checkEligibility(athleteId: string, q: Quarter) {
  const actor = await getCurrentCoach();
  await assertAthleteAccess(actor, athleteId);
  return participationEligibility(athleteId, q);
}
