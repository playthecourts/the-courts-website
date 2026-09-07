"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  getCurrentCoach,
  assertSessionAccess,
  assertAthleteAccess,
  canManageCapacity,
  denyUnlessManagesSport,
} from "@/lib/coach-dal";
import { auditLog } from "@/lib/audit";
import type { AttendanceStatus, NoteVisibility } from "@/generated/prisma/enums";

// Every action re-runs getCurrentCoach() + the relevant assert*. Server actions
// are public HTTP endpoints — the fact that a button was only rendered for
// certain coaches guarantees nothing about who can invoke the action behind it.

/**
 * Booking.status is the seat; AttendanceRecord is what happened. We write the
 * record and mirror a coarse equivalent onto the booking in ONE transaction, so
 * the pre-existing /admin roster (which reads Booking.status) can't drift.
 * "excused" maps back to `booked` — an excused absence is not a no-show.
 */
function bookingStatusFor(status: AttendanceStatus) {
  if (status === "present" || status === "late") return "attended" as const;
  if (status === "absent") return "no_show" as const;
  return "booked" as const;
}

export async function markAttendance(
  sessionId: string,
  bookingId: string,
  status: AttendanceStatus
) {
  const actor = await getCurrentCoach();
  await assertSessionAccess(actor, sessionId);

  // The booking must belong to the session we just authorized — otherwise a
  // coach with access to one session could mark attendance on any booking id.
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, sessionId },
    select: { id: true },
  });
  if (!booking) return { ok: false as const, error: "That athlete isn't on this roster." };

  await prisma.$transaction([
    prisma.attendanceRecord.upsert({
      where: { bookingId },
      create: {
        bookingId,
        status,
        recordedById: actor.id,
        checkedInAt: status === "present" || status === "late" ? new Date() : null,
      },
      update: {
        status,
        recordedById: actor.id,
        recordedAt: new Date(),
        checkedInAt: status === "present" || status === "late" ? new Date() : null,
      },
    }),
    prisma.booking.update({ where: { id: bookingId }, data: { status: bookingStatusFor(status) } }),
  ]);

  revalidatePath(`/coach/sessions/${sessionId}`);
  return { ok: true as const };
}

/** "Mark All Here", then handle exceptions — the fast path for a full court. */
export async function markAllHere(sessionId: string) {
  const actor = await getCurrentCoach();
  await assertSessionAccess(actor, sessionId);

  const bookings = await prisma.booking.findMany({
    where: { sessionId, status: { not: "cancelled" } },
    select: { id: true },
  });
  const now = new Date();

  await prisma.$transaction([
    ...bookings.map((b) =>
      prisma.attendanceRecord.upsert({
        where: { bookingId: b.id },
        create: { bookingId: b.id, status: "present", recordedById: actor.id, checkedInAt: now },
        update: { status: "present", recordedById: actor.id, recordedAt: now, checkedInAt: now },
      })
    ),
    prisma.booking.updateMany({
      where: { sessionId, status: { not: "cancelled" } },
      data: { status: "attended" },
    }),
  ]);

  await auditLog(actor.id, "record_attendance", "session", sessionId, {
    bulk: true,
    count: bookings.length,
  });
  revalidatePath(`/coach/sessions/${sessionId}`);
  return { ok: true as const, count: bookings.length };
}

export async function saveSessionNote(sessionId: string, formData: FormData) {
  const actor = await getCurrentCoach();
  await assertSessionAccess(actor, sessionId);

  const body = ((formData.get("body") as string) || "").trim();
  if (!body) return;

  await prisma.sessionNote.create({ data: { sessionId, staffUserId: actor.id, body } });
  revalidatePath(`/coach/sessions/${sessionId}`);
}

/**
 * A coach note about one athlete.
 *
 * visibility comes from an explicit radio choice with no default-to-shared
 * path, and sharing is audit-logged. This is the boundary a coach must never
 * cross by accident, so it is a deliberate, recorded act.
 */
export async function saveCoachNote(sessionId: string | null, formData: FormData) {
  const actor = await getCurrentCoach();

  const athleteId = formData.get("athleteId") as string;
  await assertAthleteAccess(actor, athleteId);
  if (sessionId) await assertSessionAccess(actor, sessionId);

  const body = ((formData.get("body") as string) || "").trim();
  const focus = ((formData.get("focus") as string) || "").trim();
  const workingOn = ((formData.get("workingOn") as string) || "").trim();
  const nextRecommendation = ((formData.get("nextRecommendation") as string) || "").trim();
  const tags = formData.getAll("tags").map(String).filter(Boolean);

  if (!body && !focus && !workingOn && tags.length === 0) return;

  // Anything not explicitly "parent_shared" is private. Fail closed.
  const requested = formData.get("visibility");
  const visibility: NoteVisibility = requested === "parent_shared" ? "parent_shared" : "staff_private";

  const note = await prisma.coachNote.create({
    data: {
      athleteId,
      staffUserId: actor.id,
      sessionId: sessionId ?? null,
      visibility,
      body,
      tags,
      focus: focus || null,
      workingOn: workingOn || null,
      nextRecommendation: nextRecommendation || null,
    },
  });

  if (visibility === "parent_shared") {
    await auditLog(actor.id, "share_note_with_parent", "coach_note", note.id, { athleteId });
  }

  if (sessionId) revalidatePath(`/coach/sessions/${sessionId}`);
  revalidatePath(`/coach/athletes/${athleteId}`);
}

/** Revealing emergency/medical info is allowed but always recorded. */
export async function revealEmergencyInfo(athleteId: string) {
  const actor = await getCurrentCoach();
  await assertAthleteAccess(actor, athleteId);

  const athlete = await prisma.athlete.findUniqueOrThrow({
    where: { id: athleteId },
    select: { emergencyContact: true, medicalNotes: true },
  });

  await auditLog(actor.id, "view_emergency_info", "athlete", athleteId);
  if (athlete.medicalNotes) {
    await auditLog(actor.id, "view_medical_notes", "athlete", athleteId);
  }

  return {
    emergencyContact: athlete.emergencyContact,
    medicalNotes: athlete.medicalNotes,
  };
}

// --- Session plan -----------------------------------------------------------

export async function savePlanItem(sessionId: string, formData: FormData) {
  const actor = await getCurrentCoach();
  await assertSessionAccess(actor, sessionId);

  const activity = ((formData.get("activity") as string) || "").trim();
  const minutes = parseInt((formData.get("minutes") as string) || "0", 10);
  if (!activity || !Number.isFinite(minutes) || minutes <= 0) return;

  const plan = await prisma.sessionPlan.upsert({
    where: { sessionId },
    create: { sessionId, staffUserId: actor.id },
    update: {},
    include: { items: true },
  });

  await prisma.sessionPlanItem.create({
    data: { planId: plan.id, position: plan.items.length, minutes, activity },
  });
  revalidatePath(`/coach/sessions/${sessionId}`);
}

export async function deletePlanItem(sessionId: string, itemId: string) {
  const actor = await getCurrentCoach();
  await assertSessionAccess(actor, sessionId);

  // Scope the delete through the plan's session so an item id from another
  // session can't be removed by replaying this action.
  await prisma.sessionPlanItem.deleteMany({ where: { id: itemId, plan: { sessionId } } });
  revalidatePath(`/coach/sessions/${sessionId}`);
}

/** Reorder by swapping with the neighbour — no drag-and-drop needed on a phone. */
export async function movePlanItem(sessionId: string, itemId: string, direction: "up" | "down") {
  const actor = await getCurrentCoach();
  await assertSessionAccess(actor, sessionId);

  const plan = await prisma.sessionPlan.findUnique({
    where: { sessionId },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!plan) return;

  const index = plan.items.findIndex((i) => i.id === itemId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= plan.items.length) return;

  const a = plan.items[index];
  const b = plan.items[swapWith];
  await prisma.$transaction([
    prisma.sessionPlanItem.update({ where: { id: a.id }, data: { position: b.position } }),
    prisma.sessionPlanItem.update({ where: { id: b.id }, data: { position: a.position } }),
  ]);
  revalidatePath(`/coach/sessions/${sessionId}`);
}

/** Copy a session's plan from an approved template (coaching library). */
export async function applyPlanTemplate(sessionId: string, formData: FormData) {
  const actor = await getCurrentCoach();
  await assertSessionAccess(actor, sessionId);

  const templateId = formData.get("templateId") as string;
  const template = await prisma.planTemplate.findFirst({
    where: { id: templateId, approved: true },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!template) return;

  const plan = await prisma.sessionPlan.upsert({
    where: { sessionId },
    create: { sessionId, staffUserId: actor.id },
    update: {},
  });
  await prisma.sessionPlanItem.deleteMany({ where: { planId: plan.id } });
  await prisma.sessionPlanItem.createMany({
    data: template.items.map((i, idx) => ({
      planId: plan.id,
      position: idx,
      minutes: i.minutes,
      activity: i.activity,
      notes: i.notes,
    })),
  });
  revalidatePath(`/coach/sessions/${sessionId}`);
}

// --- Capacity (head coach / admin only) -------------------------------------

export async function updateCapacity(sessionId: string, formData: FormData) {
  const actor = await getCurrentCoach();
  await assertSessionAccess(actor, sessionId);

  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: { program: true },
  });
  // A plain coach can see this session but may not resize it.
  denyUnlessManagesSport(actor, session.program.sport);

  const capacity = parseInt((formData.get("capacity") as string) || "", 10);
  if (!Number.isFinite(capacity) || capacity < 0) return;

  await prisma.session.update({ where: { id: sessionId }, data: { capacity } });
  await auditLog(actor.id, "change_capacity", "session", sessionId, {
    from: session.capacity,
    to: capacity,
  });
  revalidatePath(`/coach/sessions/${sessionId}`);
}

/**
 * Offer a waitlisted athlete the open seat. Converts the existing
 * WaitlistEntry into a Booking rather than creating a parallel record — the
 * Parent App reads the same Booking, so the family sees it immediately.
 */
export async function offerWaitlistSpot(sessionId: string, entryId: string) {
  const actor = await getCurrentCoach();
  await assertSessionAccess(actor, sessionId);

  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: { program: true },
  });
  if (!canManageCapacity(actor, session.program.sport)) {
    return { ok: false as const, error: "Only a head coach or admin can move an athlete in." };
  }

  const entry = await prisma.waitlistEntry.findFirst({
    where: { id: entryId, sessionId, status: "waiting" },
  });
  if (!entry) return { ok: false as const, error: "That waitlist entry is no longer waiting." };

  await prisma.$transaction(async (tx) => {
    const booked = await tx.booking.count({
      where: { sessionId, status: { not: "cancelled" } },
    });
    if (booked >= session.capacity) throw new Error("full");

    await tx.booking.upsert({
      where: { sessionId_athleteId: { sessionId, athleteId: entry.athleteId } },
      create: { sessionId, athleteId: entry.athleteId, status: "booked" },
      update: { status: "booked" },
    });
    await tx.waitlistEntry.update({ where: { id: entry.id }, data: { status: "converted" } });
  });

  await auditLog(actor.id, "offer_waitlist_spot", "session", sessionId, { athleteId: entry.athleteId });
  revalidatePath(`/coach/sessions/${sessionId}`);
  return { ok: true as const };
}

// --- Guided Dr. Dish --------------------------------------------------------

/**
 * Manually recorded Dr. Dish numbers. Nothing here comes from the machine —
 * there is no Dr. Dish integration in this platform, and no value is inferred.
 */
export async function saveDrDishLog(sessionId: string, formData: FormData) {
  const actor = await getCurrentCoach();
  await assertSessionAccess(actor, sessionId);

  const athleteId = formData.get("athleteId") as string;
  await assertAthleteAccess(actor, athleteId);

  const num = (key: string) => {
    const raw = (formData.get(key) as string) || "";
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  await prisma.drDishLog.upsert({
    where: { sessionId_athleteId: { sessionId, athleteId } },
    create: {
      sessionId,
      athleteId,
      staffUserId: actor.id,
      workout: ((formData.get("workout") as string) || "").trim() || null,
      makes: num("makes"),
      attempts: num("attempts"),
      focus: ((formData.get("focus") as string) || "").trim() || null,
    },
    update: {
      workout: ((formData.get("workout") as string) || "").trim() || null,
      makes: num("makes"),
      attempts: num("attempts"),
      focus: ((formData.get("focus") as string) || "").trim() || null,
    },
  });
  revalidatePath(`/coach/sessions/${sessionId}`);
}

// --- Coverage ---------------------------------------------------------------

export async function requestCoverage(sessionId: string, formData: FormData) {
  const actor = await getCurrentCoach();
  await assertSessionAccess(actor, sessionId);

  const reason = ((formData.get("reason") as string) || "").trim() || null;

  const existing = await prisma.coverageRequest.findFirst({
    where: { sessionId, requestedById: actor.id, status: "open" },
  });
  if (existing) return;

  await prisma.coverageRequest.create({
    data: { sessionId, requestedById: actor.id, reason },
  });
  revalidatePath(`/coach/sessions/${sessionId}`);
  revalidatePath("/coach/coverage");
}
