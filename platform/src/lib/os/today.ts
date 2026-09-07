import "server-only";
import { prisma } from "@/lib/prisma";
import type { OsActor } from "./permissions";
import { sessionScope } from "./dal";
import { dayBounds } from "./format";

// Queries behind the Today screen. Each returns exactly what the view renders
// — no over-fetching a whole day of bookings to count them in JS.

export type TodaySession = Awaited<ReturnType<typeof getTodaySessions>>[number];

export async function getTodaySessions(actor: OsActor, day = new Date()) {
  const { start, end } = dayBounds(day);

  const sessions = await prisma.session.findMany({
    where: {
      AND: [
        sessionScope(actor),
        { startTime: { gte: start, lt: end } },
      ],
    },
    orderBy: [{ startTime: "asc" }],
    select: {
      id: true,
      startTime: true,
      endTime: true,
      capacity: true,
      status: true,
      program: {
        select: { id: true, name: true, sport: true, programType: true, gradeMin: true, gradeMax: true },
      },
      resource: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      coaches: {
        select: { role: true, staff: { select: { id: true, name: true } } },
      },
      _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } },
    },
  });

  return sessions.map((s) => ({
    ...s,
    booked: s._count.bookings,
    openSpots: Math.max(0, s.capacity - s._count.bookings),
    isFull: s._count.bookings >= s.capacity,
  }));
}

export type TodayCounts = {
  sessionCount: number;
  athletesScheduled: number;
  coachesWorking: number;
  openSpotsTonight: number;
  cancelledCount: number;
};

/// Counts for the Today header. "Tonight" is 4pm onward — the block that
/// actually matters when someone asks "what's still open?" at lunchtime.
export function summarize(sessions: TodaySession[]): TodayCounts {
  const scheduled = sessions.filter((s) => s.status === "scheduled");
  const coachIds = new Set<string>();
  for (const s of scheduled) for (const c of s.coaches) coachIds.add(c.staff.id);

  const athletes = scheduled.reduce((n, s) => n + s.booked, 0);

  const openTonight = scheduled
    .filter((s) => {
      const hour = Number(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: false,
          timeZone: "America/Chicago",
        }).format(s.startTime)
      );
      return hour >= 16;
    })
    .reduce((n, s) => n + s.openSpots, 0);

  return {
    sessionCount: scheduled.length,
    athletesScheduled: athletes,
    coachesWorking: coachIds.size,
    openSpotsTonight: openTonight,
    cancelledCount: sessions.length - scheduled.length,
  };
}

/// The next few sessions that haven't started yet — the "NEXT UP" rail.
export function nextUp(sessions: TodaySession[], now = new Date(), limit = 6) {
  return sessions
    .filter((s) => s.status === "scheduled" && s.endTime.getTime() > now.getTime())
    .slice(0, limit);
}

/// Headline voice for the day. Personality, but driven by real load so it is
/// never merely decorative — and never applied to problems.
export function dayMood(counts: TodayCounts): string {
  if (counts.sessionCount === 0) return "Nothing on the Court.";
  if (counts.sessionCount >= 12) return "Packed House.";
  if (counts.sessionCount >= 7) return "Busy. Good Busy.";
  if (counts.openSpotsTonight > 12) return "Court Time Available.";
  return "Everybody's Got Somewhere to Be.";
}
