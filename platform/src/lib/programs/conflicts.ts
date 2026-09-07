import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Conflict detection.
//
// Two severities, and the difference is the whole point:
//
//   BLOCKING — a physical impossibility. Two programs on Court 1 at 5pm, a
//     coach in two gyms at once, a session inside a facility closure. These
//     stop a publish. There is no "save anyway" that doesn't record a reason.
//
//   WARNING — legal but worth a human look. A 10-minute coach turnaround, a
//     tight court changeover. These are shown, not enforced, because an admin
//     standing in the building knows things this system does not.
//
// Every conflict carries the specific facts (which court, which program, which
// time) and concrete next actions. "Conflict detected" with no detail is worse
// than useless — it tells an admin something is wrong and nothing about what.
// ---------------------------------------------------------------------------

export type ConflictSeverity = "blocking" | "warning";

export type ConflictAction =
  | { kind: "pick_resource"; label: string; resourceId: string }
  | { kind: "view_schedule"; label: string; at: string }
  | { kind: "change_time"; label: string }
  | { kind: "pick_coach"; label: string }
  | { kind: "override"; label: string };

export type Conflict = {
  severity: ConflictSeverity;
  type:
    | "resource_double_booked"
    | "resource_overlap"
    | "coach_double_booked"
    | "coach_unavailable"
    | "facility_closed"
    | "resource_inactive"
    | "resource_type_not_allowed"
    | "coach_turnaround"
    | "resource_turnaround";
  /// Full sentence, naming the thing and the time. This is the text an admin reads.
  message: string;
  /// Which proposed occurrence this is about, when checking a batch.
  occurrenceStart: Date;
  occurrenceEnd: Date;
  actions: ConflictAction[];
};

/// A proposed occurrence, before it exists as a Session row.
export type ProposedOccurrence = {
  startTime: Date;
  endTime: Date;
  resourceIds: string[];
  coachIds: string[];
  /// Set when re-checking an occurrence that already exists, so it doesn't
  /// conflict with itself.
  excludeSessionId?: string;
};

/// Minutes below which a back-to-back booking is flagged as tight. Not a rule
/// about what is allowed — a prompt to look.
const TIGHT_TURNAROUND_MINUTES = 15;

function fmtTime(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
}

function fmtDay(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function fmtRange(a: Date, b: Date) {
  return `${fmtTime(a)}–${fmtTime(b)}`;
}

/// Expands the requested resources to include everything they physically
/// overlap. Booking Full Court has to block Half Court A, or the conflict
/// engine is lying about availability.
type ResourceRow = {
  id: string;
  name: string;
  active: boolean;
  resourceType: string;
  allowedProgramTypes: string[];
  overlapsResourceIds: string[];
};

async function expandResources(resourceIds: string[]): Promise<Map<string, ResourceRow>> {
  if (resourceIds.length === 0) return new Map();
  const select = {
    id: true,
    name: true,
    active: true,
    resourceType: true,
    allowedProgramTypes: true,
    overlapsResourceIds: true,
  } as const;
  const direct = await prisma.resource.findMany({ where: { id: { in: resourceIds } }, select });
  const overlapIds = direct.flatMap((r) => r.overlapsResourceIds);
  const all = overlapIds.length
    ? await prisma.resource.findMany({
        where: { id: { in: [...resourceIds, ...overlapIds] } },
        select,
      })
    : direct;
  return new Map(all.map((r) => [r.id, { ...r, allowedProgramTypes: r.allowedProgramTypes as string[] }]));
}

/// The core check. Runs over a whole batch of proposed occurrences at once so
/// the schedule preview can flag every problem before anything is created,
/// rather than failing on the third of eleven sessions.
export async function findConflicts(
  occurrences: ProposedOccurrence[],
  opts: { programType?: string } = {}
): Promise<Conflict[]> {
  if (occurrences.length === 0) return [];

  const conflicts: Conflict[] = [];
  const windowStart = new Date(Math.min(...occurrences.map((o) => o.startTime.getTime())));
  const windowEnd = new Date(Math.max(...occurrences.map((o) => o.endTime.getTime())));
  // Widen the fetch window so turnaround checks can see the neighbours.
  const fetchStart = new Date(windowStart.getTime() - 4 * 60 * 60_000);
  const fetchEnd = new Date(windowEnd.getTime() + 4 * 60 * 60_000);

  const allResourceIds = [...new Set(occurrences.flatMap((o) => o.resourceIds))];
  const allCoachIds = [...new Set(occurrences.flatMap((o) => o.coachIds))];
  const resourceMap = await expandResources(allResourceIds);
  const excludeIds = occurrences.map((o) => o.excludeSessionId).filter(Boolean) as string[];

  // Everything already on the calendar in the window, fetched once.
  const [existingSessions, reservations, blocks, coaches] = await Promise.all([
    prisma.session.findMany({
      where: {
        status: "scheduled",
        startTime: { lt: fetchEnd },
        endTime: { gt: fetchStart },
        ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        resourceId: true,
        extraResources: { select: { resourceId: true } },
        coaches: { select: { staffUserId: true, staff: { select: { name: true } } } },
        offering: { select: { name: true } },
        program: { select: { name: true } },
      },
    }),
    prisma.resourceReservation.findMany({
      where: {
        status: "confirmed",
        startTime: { lt: fetchEnd },
        endTime: { gt: fetchStart },
        ...(allResourceIds.length ? { resourceId: { in: [...resourceMap.keys()] } } : {}),
      },
      select: { resourceId: true, startTime: true, endTime: true, family: { select: { name: true } } },
    }),
    prisma.facilityBlock.findMany({
      where: { startTime: { lt: fetchEnd }, endTime: { gt: fetchStart } },
      select: { resourceId: true, startTime: true, endTime: true, reason: true, note: true },
    }),
    allCoachIds.length
      ? prisma.staffUser.findMany({
          where: { id: { in: allCoachIds } },
          select: {
            id: true,
            name: true,
            availability: {
              select: { weekday: true, specificDate: true, startMinute: true, endMinute: true, status: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const coachById = new Map(coaches.map((c) => [c.id, c]));
  const overlaps = (aS: Date, aE: Date, bS: Date, bE: Date) => aS < bE && aE > bS;

  for (const occ of occurrences) {
    // --- Resources this occurrence actually occupies, overlaps included. ---
    const occupied = new Set<string>();
    for (const id of occ.resourceIds) {
      occupied.add(id);
      for (const overlapId of resourceMap.get(id)?.overlapsResourceIds ?? []) occupied.add(overlapId);
    }

    // --- Resource is retired, or not allowed to host this program type. ---
    for (const id of occ.resourceIds) {
      const r = resourceMap.get(id);
      if (!r) continue;
      if (!r.active) {
        conflicts.push({
          severity: "blocking",
          type: "resource_inactive",
          message: `${r.name} is marked inactive and can't be scheduled.`,
          occurrenceStart: occ.startTime,
          occurrenceEnd: occ.endTime,
          actions: [{ kind: "change_time", label: "Choose another resource" }],
        });
      }
      if (
        opts.programType &&
        r.allowedProgramTypes.length > 0 &&
        !r.allowedProgramTypes.includes(opts.programType)
      ) {
        conflicts.push({
          severity: "blocking",
          type: "resource_type_not_allowed",
          message: `${r.name} isn't configured for this program type.`,
          occurrenceStart: occ.startTime,
          occurrenceEnd: occ.endTime,
          actions: [{ kind: "change_time", label: "Choose another resource" }],
        });
      }
    }

    // --- Facility closures. A null resourceId closes the whole building. ---
    for (const block of blocks) {
      const appliesHere = block.resourceId === null || occupied.has(block.resourceId);
      if (!appliesHere) continue;
      if (!overlaps(occ.startTime, occ.endTime, block.startTime, block.endTime)) continue;
      const scope = block.resourceId
        ? resourceMap.get(block.resourceId)?.name ?? "That resource"
        : "The facility";
      conflicts.push({
        severity: "blocking",
        type: "facility_closed",
        message: `${scope} is closed ${fmtDay(block.startTime)} ${fmtRange(
          block.startTime,
          block.endTime
        )} — ${block.reason.replace(/_/g, " ")}${block.note ? ` (${block.note})` : ""}.`,
        occurrenceStart: occ.startTime,
        occurrenceEnd: occ.endTime,
        actions: [
          { kind: "change_time", label: "Choose another time" },
          { kind: "view_schedule", label: "View facility schedule", at: occ.startTime.toISOString() },
        ],
      });
    }

    // --- Court / resource double-booking against existing sessions. ---
    for (const existing of existingSessions) {
      const existingResources = new Set(
        [existing.resourceId, ...existing.extraResources.map((e) => e.resourceId)].filter(
          Boolean
        ) as string[]
      );
      const shared = [...occupied].filter((id) => existingResources.has(id));
      const timeClash = overlaps(occ.startTime, occ.endTime, existing.startTime, existing.endTime);
      const label = existing.offering?.name ?? existing.program.name;

      if (shared.length && timeClash) {
        const name = resourceMap.get(shared[0])?.name ?? "That court";
        const isIndirect = !occ.resourceIds.includes(shared[0]);
        conflicts.push({
          severity: "blocking",
          type: isIndirect ? "resource_overlap" : "resource_double_booked",
          message: isIndirect
            ? `${name} overlaps a court you selected and is already booked ${fmtDay(
                existing.startTime
              )} ${fmtRange(existing.startTime, existing.endTime)} for ${label}.`
            : `${name} is already booked ${fmtDay(existing.startTime)} ${fmtRange(
                existing.startTime,
                existing.endTime
              )} for ${label}.`,
          occurrenceStart: occ.startTime,
          occurrenceEnd: occ.endTime,
          actions: [
            ...[...resourceMap.values()]
              .filter((r) => r.active && !existingResources.has(r.id) && !occupied.has(r.id))
              .slice(0, 2)
              .map((r) => ({ kind: "pick_resource" as const, label: `Use ${r.name}`, resourceId: r.id })),
            { kind: "change_time", label: "Choose another time" },
            { kind: "view_schedule", label: "View schedule", at: occ.startTime.toISOString() },
          ],
        });
      } else if (shared.length && !timeClash) {
        // Same court, back to back — is the changeover realistic?
        const gapMs = Math.min(
          Math.abs(occ.startTime.getTime() - existing.endTime.getTime()),
          Math.abs(existing.startTime.getTime() - occ.endTime.getTime())
        );
        const gapMin = Math.round(gapMs / 60_000);
        if (gapMin < TIGHT_TURNAROUND_MINUTES) {
          const name = resourceMap.get(shared[0])?.name ?? "That court";
          conflicts.push({
            severity: "warning",
            type: "resource_turnaround",
            message: `Only ${gapMin} minute${gapMin === 1 ? "" : "s"} on ${name} between this and ${label}.`,
            occurrenceStart: occ.startTime,
            occurrenceEnd: occ.endTime,
            actions: [{ kind: "override", label: "Schedule anyway" }],
          });
        }
      }

      // --- Coach double-booking, and tight coach turnaround. ---
      const sharedCoaches = existing.coaches.filter((c) => occ.coachIds.includes(c.staffUserId));
      if (sharedCoaches.length && timeClash) {
        for (const c of sharedCoaches) {
          conflicts.push({
            severity: "blocking",
            type: "coach_double_booked",
            message: `${c.staff.name} is already coaching ${label} ${fmtDay(
              existing.startTime
            )} ${fmtRange(existing.startTime, existing.endTime)}.`,
            occurrenceStart: occ.startTime,
            occurrenceEnd: occ.endTime,
            actions: [
              { kind: "pick_coach", label: "Assign a different coach" },
              { kind: "change_time", label: "Choose another time" },
            ],
          });
        }
      } else if (sharedCoaches.length && !timeClash) {
        const gapMin = Math.round(
          Math.min(
            Math.abs(occ.startTime.getTime() - existing.endTime.getTime()),
            Math.abs(existing.startTime.getTime() - occ.endTime.getTime())
          ) / 60_000
        );
        if (gapMin < TIGHT_TURNAROUND_MINUTES) {
          for (const c of sharedCoaches) {
            conflicts.push({
              severity: "warning",
              type: "coach_turnaround",
              message: `${c.staff.name} has only ${gapMin} minute${
                gapMin === 1 ? "" : "s"
              } between ${label} and this session.`,
              occurrenceStart: occ.startTime,
              occurrenceEnd: occ.endTime,
              actions: [{ kind: "override", label: "Schedule anyway" }],
            });
          }
        }
      }
    }

    // --- Ad-hoc court rentals booked outside the program catalog. ---
    for (const res of reservations) {
      if (!occupied.has(res.resourceId)) continue;
      if (!overlaps(occ.startTime, occ.endTime, res.startTime, res.endTime)) continue;
      conflicts.push({
        severity: "blocking",
        type: "resource_double_booked",
        message: `${resourceMap.get(res.resourceId)?.name ?? "That court"} is rented ${fmtDay(
          res.startTime
        )} ${fmtRange(res.startTime, res.endTime)} by the ${res.family.name} family.`,
        occurrenceStart: occ.startTime,
        occurrenceEnd: occ.endTime,
        actions: [
          { kind: "change_time", label: "Choose another time" },
          { kind: "view_schedule", label: "View schedule", at: occ.startTime.toISOString() },
        ],
      });
    }

    // --- Coach marked themselves unavailable. A warning, not a block: a head
    // --- coach may legitimately need to assign over a stated preference.
    for (const coachId of occ.coachIds) {
      const coach = coachById.get(coachId);
      if (!coach) continue;
      const weekday = occ.startTime.getUTCDay();
      const startMin = occ.startTime.getUTCHours() * 60 + occ.startTime.getUTCMinutes();
      const endMin = startMin + (occ.endTime.getTime() - occ.startTime.getTime()) / 60_000;
      const dateKey = occ.startTime.toISOString().slice(0, 10);

      for (const a of coach.availability) {
        if (a.status !== "unavailable") continue;
        const matchesDay =
          a.specificDate != null
            ? a.specificDate.toISOString().slice(0, 10) === dateKey
            : a.weekday === weekday;
        if (!matchesDay) continue;
        if (startMin < a.endMinute && endMin > a.startMinute) {
          conflicts.push({
            severity: "warning",
            type: "coach_unavailable",
            message: `${coach.name} is marked unavailable ${fmtDay(occ.startTime)} at this time.`,
            occurrenceStart: occ.startTime,
            occurrenceEnd: occ.endTime,
            actions: [
              { kind: "pick_coach", label: "Assign a different coach" },
              { kind: "override", label: "Assign anyway" },
            ],
          });
        }
      }
    }
  }

  return conflicts;
}

export function blockingOnly(conflicts: Conflict[]) {
  return conflicts.filter((c) => c.severity === "blocking");
}

export function warningsOnly(conflicts: Conflict[]) {
  return conflicts.filter((c) => c.severity === "warning");
}

/// Transactional last line of defence.
///
/// findConflicts above runs against a snapshot and is what the admin sees. This
/// runs inside the write transaction with the resource rows LOCKED, so two
/// admins clicking Publish at the same moment cannot both pass a check and both
/// create a booking. Same lock-then-check-then-act shape as bookAthleteIntoSession.
export class ResourceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceConflictError";
  }
}

export async function assertResourcesFree(
  tx: Prisma.TransactionClient,
  resourceIds: string[],
  startTime: Date,
  endTime: Date,
  excludeSessionId?: string
) {
  if (resourceIds.length === 0) return;

  const resources = await tx.resource.findMany({ where: { id: { in: resourceIds } } });
  const occupied = new Set<string>(resourceIds);
  for (const r of resources) for (const o of r.overlapsResourceIds) occupied.add(o);
  const ids = [...occupied].sort(); // Stable order: prevents deadlock between concurrent writers.

  await tx.$executeRaw`SELECT id FROM resources WHERE id = ANY(${ids}) ORDER BY id FOR UPDATE`;

  const clash = await tx.session.findFirst({
    where: {
      status: "scheduled",
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
      OR: [{ resourceId: { in: ids } }, { extraResources: { some: { resourceId: { in: ids } } } }],
    },
    select: { resourceId: true, offering: { select: { name: true } }, program: { select: { name: true } } },
  });
  if (clash) {
    const name = resources.find((r) => r.id === clash.resourceId)?.name ?? "That court";
    throw new ResourceConflictError(
      `${name} was just booked for ${clash.offering?.name ?? clash.program.name}. Nothing was saved.`
    );
  }

  const rental = await tx.resourceReservation.findFirst({
    where: {
      status: "confirmed",
      resourceId: { in: ids },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    select: { resourceId: true },
  });
  if (rental) {
    const name = resources.find((r) => r.id === rental.resourceId)?.name ?? "That court";
    throw new ResourceConflictError(`${name} was just rented for that time. Nothing was saved.`);
  }

  const block = await tx.facilityBlock.findFirst({
    where: {
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      OR: [{ resourceId: null }, { resourceId: { in: ids } }],
    },
    select: { reason: true },
  });
  if (block) {
    throw new ResourceConflictError(
      `That time is inside a facility closure (${block.reason.replace(/_/g, " ")}). Nothing was saved.`
    );
  }
}
