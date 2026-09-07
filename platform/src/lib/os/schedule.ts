import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { OsActor } from "./permissions";
import { sessionScope } from "./dal";

// Schedule reads + conflict detection.
//
// Conflicts are computed against three things at once — other sessions, ad-hoc
// resource reservations, and facility blocks — because a court can be taken by
// any of them. Anything that only checked sessions would happily schedule a
// class into a maintenance window.

export type ScheduleFilters = {
  sport?: string | null;
  programType?: string | null;
  coachId?: string | null;
  resourceId?: string | null;
  /// "unstaffed" surfaces sessions with nobody assigned — linked from the
  /// attention queue.
  filter?: string | null;
};

export function buildSessionWhere(
  actor: OsActor,
  start: Date,
  end: Date,
  f: ScheduleFilters
): Prisma.SessionWhereInput {
  const and: Prisma.SessionWhereInput[] = [
    sessionScope(actor),
    { startTime: { gte: start, lt: end } },
  ];

  if (f.sport) and.push({ program: { sport: f.sport } });
  if (f.programType) and.push({ program: { programType: f.programType as never } });
  if (f.resourceId) and.push({ resourceId: f.resourceId });
  if (f.coachId) and.push({ coaches: { some: { staffUserId: f.coachId } } });
  if (f.filter === "unstaffed") {
    and.push({ coaches: { none: {} } });
    and.push({ program: { programType: { notIn: ["rental", "resource"] } } });
  }

  return { AND: and };
}

export const SESSION_SELECT = {
  id: true,
  startTime: true,
  endTime: true,
  capacity: true,
  status: true,
  resourceId: true,
  program: {
    select: {
      id: true,
      name: true,
      sport: true,
      programType: true,
      gradeMin: true,
      gradeMax: true,
    },
  },
  resource: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
  coaches: { select: { role: true, staff: { select: { id: true, name: true } } } },
  _count: { select: { bookings: { where: { status: { not: "cancelled" as const } } } } },
} satisfies Prisma.SessionSelect;

export async function getSessions(
  actor: OsActor,
  start: Date,
  end: Date,
  filters: ScheduleFilters = {}
) {
  const rows = await prisma.session.findMany({
    where: buildSessionWhere(actor, start, end, filters),
    orderBy: [{ startTime: "asc" }],
    select: SESSION_SELECT,
  });
  return rows.map((s) => ({
    ...s,
    booked: s._count.bookings,
    openSpots: Math.max(0, s.capacity - s._count.bookings),
    isFull: s._count.bookings >= s.capacity,
  }));
}

export type ScheduleSession = Awaited<ReturnType<typeof getSessions>>[number];

/// Everything occupying a resource in a window: sessions, ad-hoc rentals and
/// facility blocks, normalized into one shape the facility grid can render.
export type Occupancy = {
  kind: "session" | "reservation" | "block";
  id: string;
  resourceId: string | null;
  startTime: Date;
  endTime: Date;
  label: string;
  sublabel: string | null;
  href: string | null;
  tone: "brand" | "info" | "neutral" | "danger";
};

export async function getOccupancy(
  actor: OsActor,
  start: Date,
  end: Date,
  filters: ScheduleFilters = {}
): Promise<Occupancy[]> {
  const [sessions, reservations, blocks] = await Promise.all([
    getSessions(actor, start, end, filters),
    prisma.resourceReservation.findMany({
      where: {
        status: "confirmed",
        startTime: { lt: end },
        endTime: { gt: start },
        ...(filters.resourceId ? { resourceId: filters.resourceId } : {}),
      },
      select: {
        id: true,
        resourceId: true,
        startTime: true,
        endTime: true,
        family: { select: { id: true, name: true } },
      },
    }),
    prisma.facilityBlock.findMany({
      where: {
        startTime: { lt: end },
        endTime: { gt: start },
      },
      select: {
        id: true,
        resourceId: true,
        startTime: true,
        endTime: true,
        reason: true,
        note: true,
      },
    }),
  ]);

  const out: Occupancy[] = [];

  for (const s of sessions) {
    if (s.status === "cancelled") continue;
    out.push({
      kind: "session",
      id: s.id,
      resourceId: s.resourceId,
      startTime: s.startTime,
      endTime: s.endTime,
      label: s.program.name,
      sublabel: `${s.booked}/${s.capacity}${
        s.coaches[0] ? ` · ${s.coaches[0].staff.name}` : ""
      }`,
      href: `/os/sessions/${s.id}`,
      tone: "brand",
    });
  }

  for (const r of reservations) {
    out.push({
      kind: "reservation",
      id: r.id,
      resourceId: r.resourceId,
      startTime: r.startTime,
      endTime: r.endTime,
      label: "Court Rental",
      sublabel: r.family.name,
      href: `/os/rentals/${r.id}`,
      tone: "info",
    });
  }

  for (const b of blocks) {
    out.push({
      kind: "block",
      id: b.id,
      resourceId: b.resourceId,
      startTime: b.startTime,
      endTime: b.endTime,
      label: b.reason.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      sublabel: b.note ?? (b.resourceId ? null : "Whole facility"),
      href: `/os/facility`,
      tone: "neutral",
    });
  }

  return out.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

/// Pairs of overlapping items on the same resource. Used by the facility view
/// and the attention queue to surface accidental double-booking that already
/// exists — the write path prevents new ones (see assertSlotAvailable).
export type Conflict = {
  resourceId: string;
  a: Occupancy;
  b: Occupancy;
};

export function findConflicts(items: Occupancy[]): Conflict[] {
  const byResource = new Map<string, Occupancy[]>();
  for (const it of items) {
    if (!it.resourceId) continue;
    const list = byResource.get(it.resourceId) ?? [];
    list.push(it);
    byResource.set(it.resourceId, list);
  }

  const conflicts: Conflict[] = [];
  for (const [resourceId, list] of byResource) {
    const sorted = [...list].sort((x, y) => x.startTime.getTime() - y.startTime.getTime());
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        // Sorted by start, so once one starts at/after i's end, so do the rest.
        if (sorted[j].startTime >= sorted[i].endTime) break;
        conflicts.push({ resourceId, a: sorted[i], b: sorted[j] });
      }
    }
  }
  return conflicts;
}

/// Gaps on each court within business hours — the "open capacity" tool. Unused
/// inventory is the thing the spec wants surfaced, so this returns the holes,
/// not the bookings.
export type OpenSlot = {
  resourceId: string;
  resourceName: string;
  start: Date;
  end: Date;
  minutes: number;
};

export function findOpenSlots(
  resources: { id: string; name: string }[],
  items: Occupancy[],
  dayStart: Date,
  openMinute = 8 * 60,
  closeMinute = 21 * 60,
  minLengthMinutes = 60
): OpenSlot[] {
  const out: OpenSlot[] = [];
  const windowStart = new Date(dayStart.getTime() + openMinute * 60_000);
  const windowEnd = new Date(dayStart.getTime() + closeMinute * 60_000);

  for (const r of resources) {
    // A whole-facility block (resourceId null) closes every court.
    const taken = items
      .filter((i) => i.resourceId === r.id || (i.kind === "block" && i.resourceId === null))
      .map((i) => ({ start: i.startTime, end: i.endTime }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    let cursor = windowStart;
    for (const t of taken) {
      if (t.end <= cursor) continue;
      if (t.start > cursor) {
        const gapEnd = t.start < windowEnd ? t.start : windowEnd;
        const mins = (gapEnd.getTime() - cursor.getTime()) / 60_000;
        if (mins >= minLengthMinutes)
          out.push({
            resourceId: r.id,
            resourceName: r.name,
            start: cursor,
            end: gapEnd,
            minutes: mins,
          });
      }
      if (t.end > cursor) cursor = t.end;
      if (cursor >= windowEnd) break;
    }
    if (cursor < windowEnd) {
      const mins = (windowEnd.getTime() - cursor.getTime()) / 60_000;
      if (mins >= minLengthMinutes)
        out.push({
          resourceId: r.id,
          resourceName: r.name,
          start: cursor,
          end: windowEnd,
          minutes: mins,
        });
    }
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
