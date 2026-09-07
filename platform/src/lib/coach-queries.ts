import "server-only";
import { prisma } from "@/lib/prisma";
import { type CoachActor, sessionScope, isLeadership } from "@/lib/coach-dal";
import { startOfDay, endOfDay } from "@/lib/coach-format";

// Shared reads for the Coach App. Every query here composes sessionScope()
// rather than filtering after the fact — see coach-dal.ts for why.

/** Sessions the actor can see within a time window, in order. */
export async function sessionsInRange(actor: CoachActor, from: Date, to: Date) {
  return prisma.session.findMany({
    where: {
      AND: [
        sessionScope(actor),
        { startTime: { gte: from, lte: to } },
        { status: "scheduled" },
      ],
    },
    orderBy: { startTime: "asc" },
    include: {
      program: true,
      team: true,
      resource: true,
      coaches: { include: { staff: { select: { id: true, name: true } } } },
      _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } },
    },
  });
}

export async function sessionsForDay(actor: CoachActor, day: Date) {
  return sessionsInRange(actor, startOfDay(day), endOfDay(day));
}

export type CoachSession = Awaited<ReturnType<typeof sessionsInRange>>[number];

/**
 * Confirmed count for a session — how many families have actually said yes.
 * For team sessions that's an RSVP of "going"; for everything else a booking
 * is itself the confirmation, so it equals the registered count.
 */
export async function confirmedCounts(sessionIds: string[]) {
  if (sessionIds.length === 0) return new Map<string, number>();
  const rows = await prisma.booking.groupBy({
    by: ["sessionId"],
    where: {
      sessionId: { in: sessionIds },
      status: { not: "cancelled" },
      rsvpStatus: "going",
    },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.sessionId, r._count._all]));
}

export type ActionItem = {
  label: string;
  detail?: string;
  href: string;
  /** urgent items use plain, direct language and are never softened. */
  urgent?: boolean;
};

/**
 * "Before You Hit the Court" — surfaced only when something genuinely needs
 * attention. Every item here is a real, queried condition; none are
 * placeholders, and the section renders nothing when the list is empty.
 */
export async function todayActionItems(actor: CoachActor, day: Date): Promise<ActionItem[]> {
  const items: ActionItem[] = [];
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);

  const todaysSessions = await prisma.session.findMany({
    where: {
      AND: [sessionScope(actor), { startTime: { gte: dayStart, lte: dayEnd } }, { status: "scheduled" }],
    },
    select: { id: true, teamId: true, programId: true },
  });
  const sessionIds = todaysSessions.map((s) => s.id);

  if (sessionIds.length > 0) {
    // Team sessions where families haven't answered the RSVP yet.
    const teamSessionIds = todaysSessions.filter((s) => s.teamId).map((s) => s.id);
    if (teamSessionIds.length > 0) {
      const noReply = await prisma.booking.count({
        where: { sessionId: { in: teamSessionIds }, status: { not: "cancelled" }, rsvpStatus: null },
      });
      if (noReply > 0) {
        items.push({
          label: `${noReply} athlete${noReply === 1 ? "" : "s"} haven't RSVP'd`,
          href: "/coach/schedule",
        });
      }
    }

    // Athletes flagged as new / first session on today's rosters.
    const newAthletes = await prisma.athleteFlag.count({
      where: {
        active: true,
        flagType: { in: ["new_athlete", "first_session"] },
        athlete: { bookings: { some: { sessionId: { in: sessionIds }, status: { not: "cancelled" } } } },
      },
    });
    if (newAthletes > 0) {
      items.push({
        label: `${newAthletes} new athlete${newAthletes === 1 ? "" : "s"} today`,
        href: "/coach/schedule",
      });
    }

    // Payment that actually blocks participation — plain language, no euphemism.
    const pastDue = await prisma.athleteMembership.count({
      where: {
        status: "past_due",
        athlete: { bookings: { some: { sessionId: { in: sessionIds }, status: { not: "cancelled" } } } },
      },
    });
    if (pastDue > 0) {
      items.push({
        label: `${pastDue} athlete${pastDue === 1 ? "" : "s"} with a payment issue`,
        detail: "Registration is incomplete. Front desk can help the family.",
        href: "/coach/schedule",
        urgent: true,
      });
    }
  }

  // Evaluations this coach has started but not finished.
  const incompleteEvals = await prisma.evaluation.count({
    where: { staffUserId: actor.id, recommendedLevel: null },
  });
  if (incompleteEvals > 0) {
    items.push({
      label: `Evaluation notes due for ${incompleteEvals} athlete${incompleteEvals === 1 ? "" : "s"}`,
      href: "/coach/evaluations",
    });
  }

  // Coverage: a coach sees their own resolved requests; leadership sees the queue.
  if (isLeadership(actor)) {
    const openCoverage = await prisma.coverageRequest.count({
      where: { status: "open", session: sessionScope(actor) },
    });
    if (openCoverage > 0) {
      items.push({
        label: `${openCoverage} coverage request${openCoverage === 1 ? "" : "s"} need an answer`,
        href: "/coach/coverage",
        urgent: true,
      });
    }
  }
  const assignedToMe = await prisma.coverageRequest.count({
    where: { assignedToId: actor.id, status: "assigned", session: { startTime: { gte: dayStart } } },
  });
  if (assignedToMe > 0) {
    items.push({
      label: `You've been assigned ${assignedToMe} coverage session${assignedToMe === 1 ? "" : "s"}`,
      href: "/coach/coverage",
      urgent: true,
    });
  }

  return items;
}

/** Athlete flags keyed by athlete id, for roster badges. */
export async function activeFlagsFor(athleteIds: string[]) {
  if (athleteIds.length === 0) return new Map<string, string[]>();
  const flags = await prisma.athleteFlag.findMany({
    where: { athleteId: { in: athleteIds }, active: true },
    select: { athleteId: true, flagType: true },
  });
  const map = new Map<string, string[]>();
  for (const f of flags) {
    const list = map.get(f.athleteId) ?? [];
    list.push(f.flagType);
    map.set(f.athleteId, list);
  }
  return map;
}

export const FLAG_LABELS: Record<string, string> = {
  new_athlete: "NEW",
  first_session: "FIRST SESSION",
  needs_evaluation: "NEEDS EVAL",
  parent_follow_up: "FOLLOW UP",
  attendance_concern: "ATTENDANCE",
};
