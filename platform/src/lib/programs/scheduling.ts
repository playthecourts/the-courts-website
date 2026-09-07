import "server-only";
import { prisma } from "@/lib/prisma";
import { expandSchedule, findSelfOverlaps, type Occurrence, type ScheduleSpec } from "./recurrence";
import { assertResourcesFree, findConflicts, type Conflict } from "./conflicts";
import { auditLog } from "@/lib/audit";

// ---------------------------------------------------------------------------
// Creating and changing scheduled sessions.
//
// The invariants this module exists to hold:
//
//   * Session.programId always equals offering.programId. Nothing else writes
//     sessions, so the denormalized link cannot drift.
//   * A resource is locked before it is claimed, so two admins publishing at
//     once cannot double-book. (See assertResourcesFree.)
//   * Every change to a live session writes a ScheduleChange row. A parent
//     asking "when did this move and who told us?" gets an answer.
//   * That answer distinguishes intent from delivery. NOTHING in this codebase
//     sends an email or an SMS yet, so notifyFamilies/notifyCoach record that an
//     admin took responsibility for telling people — never that a message was
//     sent. See NotificationMethod in the schema.
//   * Registrations survive changes. Moving a session never detaches the
//     families who booked it.
// ---------------------------------------------------------------------------

export type SchedulePreview = {
  occurrences: Occurrence[];
  conflicts: Conflict[];
  /// Set when the spec itself is invalid; occurrences will be empty.
  error: string | null;
};

/// The preview behind "YOU'RE ABOUT TO CREATE 11 SESSIONS". Runs the same
/// expansion the writer runs, then checks every occurrence against the calendar,
/// so conflicts surface BEFORE anything is created.
export async function previewSchedule(
  offeringId: string,
  spec: ScheduleSpec,
  resourceIds: string[],
  coachIds: string[]
): Promise<SchedulePreview> {
  let occurrences: Occurrence[];
  try {
    occurrences = expandSchedule(spec);
  } catch (err) {
    return { occurrences: [], conflicts: [], error: err instanceof Error ? err.message : "Invalid schedule" };
  }

  const selfOverlaps = findSelfOverlaps(occurrences);
  if (selfOverlaps.length > 0) {
    return {
      occurrences,
      conflicts: [],
      error: "This pattern creates sessions that overlap each other. Check the days and duration.",
    };
  }

  const offering = await prisma.offering.findUniqueOrThrow({
    where: { id: offeringId },
    select: { program: { select: { programType: true } } },
  });

  const conflicts = await findConflicts(
    occurrences.map((o) => ({
      startTime: o.startTime,
      endTime: o.endTime,
      resourceIds,
      coachIds,
    })),
    { programType: offering.program.programType }
  );

  return { occurrences, conflicts, error: null };
}

export type CreateSessionsInput = {
  offeringId: string;
  spec: ScheduleSpec;
  resourceIds: string[];
  coachIds: string[];
  capacity: number;
  /// Persist the rule so "edit this and future" can regenerate the tail later.
  /// Only meaningful for recurring specs.
  saveAsSeries?: boolean;
  /// Numbers each occurrence as Day 1..N — camps.
  numberDays?: boolean;
  actorId: string;
};

/// All-or-nothing. If any occurrence in the batch conflicts, none are created:
/// a half-built series that silently skipped week 3 is worse than a refusal.
export async function createSessions(input: CreateSessionsInput) {
  const occurrences = expandSchedule(input.spec);

  const offering = await prisma.offering.findUniqueOrThrow({
    where: { id: input.offeringId },
    select: { id: true, programId: true, name: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    for (const occ of occurrences) {
      await assertResourcesFree(tx, input.resourceIds, occ.startTime, occ.endTime);
    }

    let seriesId: string | null = null;
    if (input.saveAsSeries && input.spec.kind === "recurring") {
      const rule = await tx.recurrenceRule.create({
        data: {
          offeringId: offering.id,
          frequency: input.spec.frequency,
          weekdays: input.spec.weekdays,
          startMinute: input.spec.window.startMinute,
          durationMinutes: input.spec.window.durationMinutes,
          startDate: new Date(`${input.spec.startDate}T00:00:00Z`),
          endDate: input.spec.endDate ? new Date(`${input.spec.endDate}T00:00:00Z`) : null,
          resourceId: input.resourceIds[0] ?? null,
          capacity: input.capacity,
        },
      });
      seriesId = rule.id;
    }

    const created = [];
    for (const occ of occurrences) {
      const session = await tx.session.create({
        data: {
          // Kept equal to the offering's program, always.
          programId: offering.programId,
          offeringId: offering.id,
          seriesId,
          resourceId: input.resourceIds[0] ?? null,
          startTime: occ.startTime,
          endTime: occ.endTime,
          capacity: input.capacity,
          dayIndex: input.numberDays ? occ.index : null,
        },
      });
      for (const resourceId of input.resourceIds.slice(1)) {
        await tx.sessionResource.create({ data: { sessionId: session.id, resourceId } });
      }
      for (const [i, staffUserId] of input.coachIds.entries()) {
        await tx.sessionCoach.create({
          data: { sessionId: session.id, staffUserId, role: i === 0 ? "lead" : "assistant" },
        });
      }
      created.push(session);
    }

    await tx.scheduleChange.create({
      data: {
        offeringId: offering.id,
        changeType: "created",
        newValue: `${created.length} session${created.length === 1 ? "" : "s"} scheduled`,
        changedById: input.actorId,
      },
    });

    return created;
  });

  await auditLog(input.actorId, "create_sessions", "offering", offering.id, {
    count: result.length,
    offering: offering.name,
  });
  return result;
}

export type EditScope = "this" | "this_and_future" | "series";

/// Moving a session. Validates first, records the change, and never detaches
/// registrations — the Booking rows point at the session id, which doesn't
/// change when the time does.
export async function moveSession(params: {
  sessionId: string;
  newStart: Date;
  newEnd: Date;
  newResourceIds?: string[];
  scope: EditScope;
  reason?: string;
  notifyFamilies: boolean;
  notifyCoach: boolean;
  actorId: string;
}) {
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: params.sessionId },
    include: {
      extraResources: true,
      offering: { select: { id: true, name: true } },
      _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } },
    },
  });

  const targets =
    params.scope === "this"
      ? [session]
      : await prisma.session.findMany({
          where: {
            seriesId: session.seriesId,
            status: "scheduled",
            // "This and future" leaves already-diverged occurrences alone: a
            // deliberate one-off change must not be silently reverted.
            isException: false,
            ...(params.scope === "this_and_future" ? { startTime: { gte: session.startTime } } : {}),
          },
          include: {
            extraResources: true,
            offering: { select: { id: true, name: true } },
            _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } },
          },
        });

  const shiftMs = params.newStart.getTime() - session.startTime.getTime();
  const durationMs = params.newEnd.getTime() - params.newStart.getTime();
  const resourceIds =
    params.newResourceIds ??
    ([session.resourceId, ...session.extraResources.map((r) => r.resourceId)].filter(
      Boolean
    ) as string[]);

  return prisma.$transaction(async (tx) => {
    for (const target of targets) {
      const start = params.scope === "this" ? params.newStart : new Date(target.startTime.getTime() + shiftMs);
      const end = new Date(start.getTime() + durationMs);

      await assertResourcesFree(tx, resourceIds, start, end, target.id);

      const before = `${fmt(target.startTime)}–${fmt(target.endTime)}`;
      const after = `${fmt(start)}–${fmt(end)}`;

      await tx.session.update({
        where: { id: target.id },
        data: {
          startTime: start,
          endTime: end,
          // A single-occurrence change marks it as diverged from its series.
          isException: params.scope === "this" ? true : target.isException,
          ...(params.newResourceIds ? { resourceId: params.newResourceIds[0] ?? null } : {}),
        },
      });

      if (params.newResourceIds) {
        await tx.sessionResource.deleteMany({ where: { sessionId: target.id } });
        for (const resourceId of params.newResourceIds.slice(1)) {
          await tx.sessionResource.create({ data: { sessionId: target.id, resourceId } });
        }
      }

      await tx.scheduleChange.create({
        data: {
          sessionId: target.id,
          offeringId: target.offeringId,
          changeType: "moved",
          previousValue: before,
          newValue: after,
          reason: params.reason ?? null,
          familiesNotified: params.notifyFamilies,
          coachNotified: params.notifyCoach,
          // No transport exists yet, so the only honest method is "an admin
          // said they would send it". Change this to sent_automatically at the
          // point something actually delivers, and not before.
          notificationMethod:
            params.notifyFamilies || params.notifyCoach ? "marked_manually" : null,
          affectedRegistrations: target._count.bookings,
          changedById: params.actorId,
        },
      });
    }

    await auditLog(params.actorId, "move_session", "session", params.sessionId, {
      scope: params.scope,
      count: targets.length,
    });

    return { moved: targets.length };
  });
}

/// Cancelling. Deliberately does NOT decide refunds — that is a business
/// decision with money attached, surfaced to an admin rather than automated.
/// It DOES restore Training Plan credits when The Courts cancelled, because
/// charging a family a session credit for a session The Courts called off is
/// never the right answer.
export async function cancelSession(params: {
  sessionId: string;
  scope: EditScope;
  reason: string;
  restoreCredits: boolean;
  notifyFamilies: boolean;
  notifyCoach: boolean;
  actorId: string;
}) {
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: params.sessionId },
    select: { id: true, seriesId: true, startTime: true, offeringId: true },
  });

  const targetIds =
    params.scope === "this"
      ? [session.id]
      : (
          await prisma.session.findMany({
            where: {
              seriesId: session.seriesId,
              status: "scheduled",
              ...(params.scope === "this_and_future"
                ? { startTime: { gte: session.startTime } }
                : {}),
            },
            select: { id: true },
          })
        ).map((s) => s.id);

  return prisma.$transaction(async (tx) => {
    let creditsRestored = 0;

    for (const id of targetIds) {
      const affected = await tx.booking.findMany({
        where: { sessionId: id, status: { not: "cancelled" } },
        select: { id: true, creditSource: true, creditRestored: true },
      });

      await tx.session.update({
        where: { id },
        data: {
          status: "cancelled",
          cancellationReason: params.reason,
          cancelledAt: new Date(),
          cancelledById: params.actorId,
        },
      });

      if (params.restoreCredits) {
        for (const b of affected) {
          if (b.creditSource && !b.creditRestored) {
            // Marking the booking cancelled already frees the weekly allowance,
            // which entitlements.ts computes by counting non-cancelled bookings.
            // The flag records that the restoration happened so re-running this
            // flow can't double-count it.
            await tx.booking.update({
              where: { id: b.id },
              data: { status: "cancelled", creditRestored: true },
            });
            creditsRestored++;
          } else {
            await tx.booking.update({ where: { id: b.id }, data: { status: "cancelled" } });
          }
        }
      } else {
        await tx.booking.updateMany({
          where: { sessionId: id, status: { not: "cancelled" } },
          data: { status: "cancelled" },
        });
      }

      await tx.scheduleChange.create({
        data: {
          sessionId: id,
          offeringId: session.offeringId,
          changeType: "cancelled",
          previousValue: "Scheduled",
          newValue: "Cancelled",
          reason: params.reason,
          familiesNotified: params.notifyFamilies,
          coachNotified: params.notifyCoach,
          notificationMethod:
            params.notifyFamilies || params.notifyCoach ? "marked_manually" : null,
          affectedRegistrations: affected.length,
          changedById: params.actorId,
        },
      });
    }

    await auditLog(params.actorId, "cancel_session", "session", params.sessionId, {
      scope: params.scope,
      count: targetIds.length,
      reason: params.reason,
      creditsRestored,
    });

    return { cancelled: targetIds.length, creditsRestored };
  });
}

/// A make-up session for one that was cancelled. Linked to the original so the
/// Parent App can say "replaces Tuesday 14 October" rather than showing an
/// unexplained extra session.
export async function addMakeupSession(params: {
  replacesSessionId: string;
  startTime: Date;
  endTime: Date;
  resourceIds: string[];
  coachIds: string[];
  actorId: string;
}) {
  const original = await prisma.session.findUniqueOrThrow({
    where: { id: params.replacesSessionId },
    select: { programId: true, offeringId: true, capacity: true, teamId: true },
  });

  return prisma.$transaction(async (tx) => {
    await assertResourcesFree(tx, params.resourceIds, params.startTime, params.endTime);

    const session = await tx.session.create({
      data: {
        programId: original.programId,
        offeringId: original.offeringId,
        teamId: original.teamId,
        resourceId: params.resourceIds[0] ?? null,
        startTime: params.startTime,
        endTime: params.endTime,
        capacity: original.capacity,
        title: "Make-up session",
        isException: true,
        replacesSessionId: params.replacesSessionId,
      },
    });

    for (const resourceId of params.resourceIds.slice(1)) {
      await tx.sessionResource.create({ data: { sessionId: session.id, resourceId } });
    }
    for (const [i, staffUserId] of params.coachIds.entries()) {
      await tx.sessionCoach.create({
        data: { sessionId: session.id, staffUserId, role: i === 0 ? "lead" : "assistant" },
      });
    }

    await tx.scheduleChange.create({
      data: {
        sessionId: session.id,
        offeringId: original.offeringId,
        changeType: "makeup_added",
        newValue: `${fmt(params.startTime)}–${fmt(params.endTime)}`,
        changedById: params.actorId,
      },
    });

    return session;
  });
}

function fmt(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(d);
}
