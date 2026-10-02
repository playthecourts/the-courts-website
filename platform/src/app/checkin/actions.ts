"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOsActor, OsAccessError, assertForSport } from "@/lib/os/dal";
import { can } from "@/lib/os/permissions";
import { checkInBooking, undoCheckIn } from "@/lib/checkin";
import { adminBookAthleteIntoSession } from "@/lib/booking";
import { auditLog } from "@/lib/audit";
import { setKioskCookie } from "@/lib/kiosk";

export type DeskResult = { ok: true; message?: string } | { ok: false; error: string };

// Same gate as the Front Desk layout: desk and admin staff.
async function deskActor() {
  const actor = await getOsActor();
  if (!can(actor, "families.viewSensitive")) throw new OsAccessError("Front Desk is for desk and admin staff.");
  return actor;
}

function fail(err: unknown): DeskResult {
  return { ok: false, error: err instanceof Error ? err.message : "That didn't work — try again." };
}

export async function deskCheckIn(bookingId: string): Promise<DeskResult> {
  try {
    const actor = await deskActor();
    const { late } = await checkInBooking(bookingId, actor.id, "desk");
    revalidatePath("/checkin");
    return { ok: true, message: late ? "Checked in (late)" : "Checked in" };
  } catch (err) {
    return fail(err);
  }
}

export async function deskUndoCheckIn(bookingId: string): Promise<DeskResult> {
  try {
    await deskActor();
    await undoCheckIn(bookingId);
    revalidatePath("/checkin");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/// Walk-in: book the athlete into the class (membership covers it, or it's
/// marked Due for the desk to collect) and check them in, in one tap.
export async function deskAddWalkIn(sessionId: string, athleteId: string): Promise<DeskResult> {
  try {
    const actor = await deskActor();
    if (!can(actor, "registrations.create")) throw new OsAccessError("Your role can't add athletes to classes.");
    const session = await prisma.session.findUnique({ where: { id: sessionId }, select: { program: { select: { sport: true } } } });
    if (!session) return { ok: false, error: "That class no longer exists." };
    assertForSport(actor, "registrations.create", session.program.sport);

    const result = await adminBookAthleteIntoSession(sessionId, athleteId);
    if (result.status === "full" || result.status === "waitlisted" || result.status === "already_waitlisted") {
      revalidatePath("/checkin");
      return { ok: false, error: "That class is full. Raise its capacity in Courts OS to add a walk-in." };
    }
    if (result.status === "booked") {
      await auditLog(actor.id, "admin_add_booking", "session", sessionId, { athleteId, due: result.due, walkIn: true });
    }
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { sessionId_athleteId: { sessionId, athleteId } },
      select: { id: true },
    });
    await checkInBooking(booking.id, actor.id, "desk");
    revalidatePath("/checkin");
    return { ok: true, message: result.status === "booked" && result.due ? "Added and checked in — payment Due" : "Added and checked in" };
  } catch (err) {
    return fail(err);
  }
}

/// Turns this iPad into the lobby self check-in screen.
export async function startKioskMode() {
  await deskActor();
  await setKioskCookie(true);
  redirect("/kiosk");
}
