import "server-only";
import { prisma } from "@/lib/prisma";
import type { OsActor } from "@/lib/os/permissions";
import { scopedSports } from "@/lib/os/permissions";

// The read behind the facility scheduler. One query for the week, shaped for a
// grid — the page does layout, not data assembly.

export type ScheduleCard = {
  id: string;
  offeringId: string | null;
  offeringName: string;
  programType: string;
  sport: string | null;
  start: string;
  end: string;
  startMinute: number;
  durationMinutes: number;
  dayKey: string;
  resourceNames: string[];
  resourceIds: string[];
  coachNames: string[];
  capacity: number;
  booked: number;
  waitlist: number;
  status: string;
  isException: boolean;
  title: string | null;
  offeringStatus: string | null;
};

export type ClosureBand = {
  id: string;
  reason: string;
  note: string | null;
  resourceId: string | null;
  resourceName: string | null;
  start: string;
  end: string;
};

export type ScheduleFilters = {
  sport?: string;
  coachId?: string;
  resourceId?: string;
  programType?: string;
  offeringId?: string;
};

/// Monday-anchored week containing `date`. The facility thinks in weeks that
/// start Monday even though the credit accounting is Sunday-anchored; these are
/// different questions and both are correct for their own purpose.
export function weekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return d;
}

export async function loadWeek(actor: OsActor, from: Date, filters: ScheduleFilters) {
  const start = weekStart(from);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);

  const sports = scopedSports(actor);
  const sportFilter = filters.sport
    ? [filters.sport]
    : sports && sports.length > 0
      ? sports
      : null;

  const [sessions, closures, resources, coaches] = await Promise.all([
    prisma.session.findMany({
      where: {
        startTime: { gte: start, lt: end },
        ...(sportFilter ? { program: { sport: { in: sportFilter } } } : {}),
        ...(filters.programType ? { program: { programType: filters.programType as never } } : {}),
        ...(filters.offeringId ? { offeringId: filters.offeringId } : {}),
        ...(filters.coachId ? { coaches: { some: { staffUserId: filters.coachId } } } : {}),
        ...(filters.resourceId
          ? {
              OR: [
                { resourceId: filters.resourceId },
                { extraResources: { some: { resourceId: filters.resourceId } } },
              ],
            }
          : {}),
      },
      orderBy: { startTime: "asc" },
      include: {
        program: { select: { name: true, sport: true, programType: true } },
        offering: { select: { id: true, name: true, status: true } },
        resource: { select: { id: true, name: true } },
        extraResources: { include: { resource: { select: { id: true, name: true } } } },
        coaches: { include: { staff: { select: { name: true } } } },
        _count: {
          select: {
            bookings: { where: { status: { not: "cancelled" } } },
            waitlistEntries: { where: { status: { in: ["waiting", "offered"] } } },
          },
        },
      },
    }),
    prisma.facilityBlock.findMany({
      where: { startTime: { lt: end }, endTime: { gt: start } },
      include: { resource: { select: { id: true, name: true } } },
      orderBy: { startTime: "asc" },
    }),
    prisma.resource.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.staffUser.findMany({
      where: { active: true, role: { in: ["coach", "head_coach", "admin", "owner"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const cards: ScheduleCard[] = sessions.map((s) => {
    const startMinute = s.startTime.getUTCHours() * 60 + s.startTime.getUTCMinutes();
    return {
      id: s.id,
      offeringId: s.offeringId,
      offeringName: s.offering?.name ?? s.program.name,
      programType: s.program.programType,
      sport: s.program.sport,
      start: s.startTime.toISOString(),
      end: s.endTime.toISOString(),
      startMinute,
      durationMinutes: Math.round((s.endTime.getTime() - s.startTime.getTime()) / 60000),
      dayKey: s.startTime.toISOString().slice(0, 10),
      resourceNames: [s.resource?.name, ...s.extraResources.map((r) => r.resource.name)].filter(
        Boolean
      ) as string[],
      resourceIds: [s.resourceId, ...s.extraResources.map((r) => r.resourceId)].filter(
        Boolean
      ) as string[],
      coachNames: s.coaches.map((c) => c.staff.name),
      capacity: s.capacity,
      booked: s._count.bookings,
      waitlist: s._count.waitlistEntries,
      status: s.status,
      isException: s.isException,
      title: s.title,
      offeringStatus: s.offering?.status ?? null,
    };
  });

  const bands: ClosureBand[] = closures.map((c) => ({
    id: c.id,
    reason: c.reason,
    note: c.note,
    resourceId: c.resourceId,
    resourceName: c.resource?.name ?? null,
    start: c.startTime.toISOString(),
    end: c.endTime.toISOString(),
  }));

  return { start, end, cards, closures: bands, resources, coaches };
}

/// Facility utilization for the week — prime-time usage and open court hours.
/// Reporting, deliberately kept out of the creation flow.
export function utilization(cards: ScheduleCard[], resourceCount: number, openMinutesPerDay = 14 * 60) {
  const booked = cards
    .filter((c) => c.status === "scheduled")
    .reduce((n, c) => n + c.durationMinutes * Math.max(1, c.resourceIds.length), 0);
  const available = openMinutesPerDay * 7 * Math.max(1, resourceCount);
  return {
    bookedMinutes: booked,
    availableMinutes: available,
    percent: available > 0 ? Math.round((booked / available) * 100) : 0,
  };
}
