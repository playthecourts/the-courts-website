"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCapability, assertForSport } from "@/lib/os/dal";
import { adminBookAthleteIntoSession } from "@/lib/booking";
import { auditLog } from "@/lib/audit";
import { autoEmailPaymentLink } from "@/lib/payment-link-email";
import { checkInBooking, undoCheckIn } from "@/lib/checkin";

export type AddAthleteState = { error?: string; ok?: string } | null;

/// Front-desk "Add athlete" on a Class Rosters card. Books one athlete into one
/// drop-in class through the same seat + pricing logic families use (see
/// adminBookAthleteIntoSession), and says plainly what happened.
export async function addAthleteToSession(_prev: AddAthleteState, formData: FormData): Promise<AddAthleteState> {
  try {
    const actor = await requireCapability("registrations.create");
    const sessionId = String(formData.get("sessionId") ?? "");
    const athleteId = String(formData.get("athleteId") ?? "");
    if (!sessionId || !athleteId) return { error: "Pick an athlete to add." };

    const [session, athlete] = await Promise.all([
      prisma.session.findUnique({ where: { id: sessionId }, select: { program: { select: { sport: true } } } }),
      prisma.athlete.findUnique({ where: { id: athleteId }, select: { firstName: true, nickname: true, lastName: true } }),
    ]);
    if (!session || !athlete) return { error: "That class or athlete no longer exists — refresh the page." };
    assertForSport(actor, "registrations.create", session.program.sport);

    const name = `${athlete.nickname || athlete.firstName} ${athlete.lastName}`;
    const result = await adminBookAthleteIntoSession(sessionId, athleteId);

    if (result.status === "booked") {
      await auditLog(actor.id, "admin_add_booking", "session", sessionId, { athleteId, due: result.due });
      revalidatePath("/os/rosters");
      revalidatePath("/os");
      if (!result.due) return { ok: `${name} added.` };
      // Online-only payment: email the family their link right away.
      const booking = await prisma.booking.findUniqueOrThrow({
        where: { sessionId_athleteId: { sessionId, athleteId } },
        select: { id: true },
      });
      const sent = await autoEmailPaymentLink(booking.id);
      return { ok: `${name} added. No membership covers this class, so payment is due. ${sent}` };
    }
    if (result.status === "already_booked") return { error: `${name} is already in this class.` };
    if (result.status === "waitlisted" || result.status === "already_waitlisted") {
      revalidatePath("/os/rosters");
      return { error: `The class is full, so ${name} was put on the waitlist instead.` };
    }
    return { error: `The class is full — raise capacity first if you want to add ${name}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't add that athlete." };
  }
}

/// Check in (or undo) from a Class Rosters row — the same record the Front
/// Desk, kiosk and Coach App write. Today's classes only (checkInBooking
/// enforces that), and never marked late: a staff check-in is often entered
/// after the fact.
export async function rosterSetCheckIn(bookingId: string, here: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const actor = await requireCapability("registrations.create");
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { session: { select: { program: { select: { sport: true } } } } },
    });
    if (!b) return { ok: false, error: "That booking no longer exists." };
    assertForSport(actor, "registrations.create", b.session.program.sport);
    if (here) await checkInBooking(bookingId, actor.id, "desk");
    else await undoCheckIn(bookingId);
    revalidatePath("/os/rosters");
    revalidatePath("/checkin");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't update check-in." };
  }
}
