import "server-only";
import { prisma } from "@/lib/prisma";
import type { OsActor } from "./permissions";
import { can } from "./permissions";
import { offeringScope, programScope, registrationScope, sessionScope } from "./dal";

// ---------------------------------------------------------------------------
// The Needs Attention queue.
//
// Design rule from the spec, taken literally: ONLY actionable items. Every
// entry here is something a human can go fix, and every entry links to the
// screen where fixing it happens. Nothing is here just because it changed —
// this is not a notification feed, and it stays short enough to be read.
//
// Each check is gated by capability, so the queue a Front Desk user sees is
// the subset of problems they can actually do something about.
// ---------------------------------------------------------------------------

export type Severity = "critical" | "warning" | "info";

export type AttentionItem = {
  key: string;
  severity: Severity;
  /// Plain, never cute — these are money, safety and staffing problems.
  title: string;
  detail: string;
  href: string;
  count: number;
};

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

export async function getAttentionItems(actor: OsActor): Promise<AttentionItem[]> {
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 86_400_000);
  const in7Days = new Date(now.getTime() + 7 * 86_400_000);
  const dayAgo = new Date(now.getTime() - 86_400_000);

  const items: AttentionItem[] = [];
  const jobs: Promise<void>[] = [];

  // --- Money -------------------------------------------------------------
  if (can(actor, "payments.view")) {
    jobs.push(
      (async () => {
        const n = await prisma.athleteMembership.count({ where: { status: "past_due" } });
        if (n > 0)
          items.push({
            key: "plan-past-due",
            severity: "critical",
            title: `${n} failed Training Plan ${n === 1 ? "payment" : "payments"}`,
            detail: "Stripe reported the subscription payment did not go through.",
            href: "/os/plans?status=past_due",
            count: n,
          });
      })()
    );

    jobs.push(
      (async () => {
        const n = await prisma.registration.count({
          where: { AND: [registrationScope(actor), { paymentStatus: "failed" }] },
        });
        if (n > 0)
          items.push({
            key: "reg-payment-failed",
            severity: "critical",
            title: `${n} failed registration ${n === 1 ? "payment" : "payments"}`,
            detail: "The athlete is registered but the charge failed.",
            href: "/os/registrations?paymentStatus=failed",
            count: n,
          });
      })()
    );
  }

  // --- Safety / paperwork -------------------------------------------------
  if (can(actor, "registrations.view")) {
    jobs.push(
      (async () => {
        const n = await prisma.registration.count({
          where: {
            AND: [
              registrationScope(actor),
              { status: "registered", waiversComplete: false },
              { offering: { requiredWaivers: { some: {} } } },
            ],
          },
        });
        if (n > 0)
          items.push({
            key: "waivers-missing",
            severity: "critical",
            title: `${n} ${n === 1 ? "waiver is" : "waivers are"} unsigned`,
            detail: "These athletes are registered for a program that requires a signed waiver.",
            href: "/os/registrations?waivers=missing",
            count: n,
          });
      })()
    );

    jobs.push(
      (async () => {
        const n = await prisma.registration.count({
          where: { AND: [registrationScope(actor), { status: "admin_review" }] },
        });
        if (n > 0)
          items.push({
            key: "reg-admin-review",
            severity: "warning",
            title: `${n} ${n === 1 ? "registration needs" : "registrations need"} review`,
            detail: "Flagged for a human decision before they can be confirmed.",
            href: "/os/registrations?status=admin_review",
            count: n,
          });
      })()
    );

    jobs.push(
      (async () => {
        // Older than a day, so a family mid-checkout right now isn't nagged about.
        const n = await prisma.registration.count({
          where: {
            AND: [
              registrationScope(actor),
              { status: { in: ["started", "incomplete"] } },
              { registeredAt: { lt: dayAgo } },
            ],
          },
        });
        if (n > 0)
          items.push({
            key: "reg-incomplete",
            severity: "warning",
            title: `${n} incomplete ${n === 1 ? "registration" : "registrations"}`,
            detail: "Families who started signing up more than a day ago and never finished.",
            href: "/os/registrations?status=incomplete",
            count: n,
          });
      })()
    );
  }

  // --- Staffing ----------------------------------------------------------
  if (can(actor, "coverage.view")) {
    jobs.push(
      (async () => {
        const open = await prisma.coverageRequest.findMany({
          where: { status: "open", session: { startTime: { gte: now } } },
          select: { id: true, session: { select: { startTime: true } } },
          orderBy: { session: { startTime: "asc" } },
          take: 20,
        });
        if (open.length > 0)
          items.push({
            key: "coverage-open",
            severity: "critical",
            title: `Coach coverage needed for ${open.length} ${open.length === 1 ? "session" : "sessions"}`,
            detail: "A coach has asked to be replaced and nobody is assigned yet.",
            href: "/os/coaches/coverage",
            count: open.length,
          });
      })()
    );
  }

  if (can(actor, "schedule.view")) {
    // Sessions happening soon with nobody assigned to run them.
    jobs.push(
      (async () => {
        const n = await prisma.session.count({
          where: {
            AND: [
              sessionScope(actor),
              { status: "scheduled" },
              { startTime: { gte: now, lt: in7Days } },
              { coaches: { none: {} } },
              // Rentals and self-serve resource time genuinely have no coach.
              { program: { programType: { notIn: ["rental", "resource"] } } },
            ],
          },
        });
        if (n > 0)
          items.push({
            key: "sessions-unstaffed",
            severity: "warning",
            title: `${n} ${n === 1 ? "session has" : "sessions have"} no coach assigned`,
            detail: "Scheduled in the next 7 days with nobody listed to run it.",
            href: "/os/schedule?filter=unstaffed",
            count: n,
          });
      })()
    );

    // Double-booked resources. Detected in SQL rather than by loading the
    // week and comparing in JS — this has to stay correct as the schedule grows.
    jobs.push(
      (async () => {
        const rows = await prisma.$queryRaw<{ n: bigint }[]>`
          SELECT COUNT(*)::bigint AS n
          FROM sessions a
          JOIN sessions b
            ON a.resource_id = b.resource_id
           AND a.id < b.id
           AND a.start_time < b.end_time
           AND b.start_time < a.end_time
          WHERE a.resource_id IS NOT NULL
            AND a.status = 'scheduled'
            AND b.status = 'scheduled'
            AND a.end_time >= ${now}
        `;
        const n = Number(rows[0]?.n ?? 0);
        if (n > 0)
          items.push({
            key: "court-conflict",
            severity: "critical",
            title: `${n} court ${n === 1 ? "conflict" : "conflicts"} on the schedule`,
            detail: "Two sessions are booked on the same resource at the same time.",
            href: "/os/facility?view=conflicts",
            count: n,
          });
      })()
    );
  }

  // --- Demand ------------------------------------------------------------
  if (can(actor, "registrations.view")) {
    jobs.push(
      (async () => {
        const n = await prisma.waitlistEntry.count({
          where: {
            AND: [
              { status: "waiting" },
              { session: sessionScope(actor) },
              { session: { startTime: { gte: now } } },
            ],
          },
        });
        if (n > 0)
          items.push({
            key: "waitlist",
            severity: "info",
            title: `${n} ${n === 1 ? "athlete is" : "athletes are"} on a waitlist`,
            detail: "Demand you could convert if a spot opens or you add a session.",
            href: "/os/registrations?view=waitlist",
            count: n,
          });
      })()
    );
  }

  // --- Programming deadlines ---------------------------------------------
  if (can(actor, "programs.view")) {
    jobs.push(
      (async () => {
        const closing = await prisma.offering.findMany({
          where: {
            AND: [
              offeringScope(actor),
              { status: "published" },
              { registrationClosesAt: { gte: now, lt: in3Days } },
            ],
          },
          select: { id: true, name: true, registrationClosesAt: true },
          orderBy: { registrationClosesAt: "asc" },
          take: 5,
        });
        for (const p of closing) {
          const days = Math.max(
            0,
            Math.round((p.registrationClosesAt!.getTime() - now.getTime()) / 86_400_000)
          );
          items.push({
            key: `reg-closing-${p.id}`,
            severity: "info",
            title: `${p.name} registration closes ${days === 0 ? "today" : `in ${days} ${days === 1 ? "day" : "days"}`}`,
            detail: "Last chance to promote it or extend the deadline.",
            href: `/os/offerings/${p.id}`,
            count: 1,
          });
        }
      })()
    );

    // Programs sitting in draft with sessions already on the calendar — a
    // very common way for a program to quietly never go live.
    jobs.push(
      (async () => {
        const n = await prisma.offering.count({
          where: {
            AND: [
              offeringScope(actor),
              { status: "draft" },
              { sessions: { some: { startTime: { gte: now } } } },
            ],
          },
        });
        if (n > 0)
          items.push({
            key: "draft-with-sessions",
            severity: "warning",
            title: `${n} unpublished ${n === 1 ? "program has" : "programs have"} upcoming sessions`,
            detail: "Scheduled but not visible to families — nobody can register yet.",
            href: "/os/programs?status=draft",
            count: n,
          });
      })()
    );
  }

  // --- League operations --------------------------------------------------
  if (can(actor, "leagues.view")) {
    jobs.push(
      (async () => {
        const leagues = await prisma.offering.findMany({
          where: {
            AND: [
              offeringScope(actor),
              { program: { programType: "league" } },
              { leagueStage: { in: ["evaluation_complete", "team_placement"] } },
            ],
          },
          select: {
            id: true,
            name: true,
            _count: { select: { registrations: { where: { status: "registered" } } } },
            teams: { select: { _count: { select: { members: true } } } },
          },
        });
        for (const l of leagues) {
          const placed = l.teams.reduce((n, t) => n + t._count.members, 0);
          const unplaced = l._count.registrations - placed;
          if (unplaced > 0)
            items.push({
              key: `unplaced-${l.id}`,
              severity: "warning",
              title: `${unplaced} ${unplaced === 1 ? "athlete" : "athletes"} unplaced in ${l.name}`,
              detail: "Registered for the league but not yet on a team.",
              href: `/os/leagues/${l.id}/teams`,
              count: unplaced,
            });
        }
      })()
    );
  }

  // --- Tasks --------------------------------------------------------------
  if (can(actor, "tasks.view")) {
    jobs.push(
      (async () => {
        const n = await prisma.task.count({
          where: {
            status: "open",
            dueDate: { lte: now },
            OR: [{ assignedToId: actor.id }, { assignedToId: null }],
          },
        });
        if (n > 0)
          items.push({
            key: "tasks-due",
            severity: "warning",
            title: `${n} ${n === 1 ? "task is" : "tasks are"} due`,
            detail: "Follow-ups assigned to you or unassigned, past their due date.",
            href: "/os/tasks",
            count: n,
          });
      })()
    );
  }

  await Promise.all(jobs);

  return items.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.count - a.count
  );
}
