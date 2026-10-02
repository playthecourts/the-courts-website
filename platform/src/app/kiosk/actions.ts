"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOsActor } from "@/lib/os/dal";
import { createClient } from "@/lib/supabase/server";
import { checkInBooking } from "@/lib/checkin";
import { isKioskDevice, setKioskCookie } from "@/lib/kiosk";

export type KioskResult = { ok: true; late: boolean } | { ok: false; error: string };

/// A kid tapping "Yes, that's me". Only works from a device in Kiosk Mode, and
/// only for a class that's open for self check-in right now (see
/// checkInBooking) — the booking id alone can't check anyone into anything else.
export async function kioskCheckIn(bookingId: string): Promise<KioskResult> {
  try {
    const actor = await getOsActor();
    if (!(await isKioskDevice())) return { ok: false, error: "This screen isn't in Kiosk Mode." };
    const { late } = await checkInBooking(bookingId, actor.id, "kiosk");
    revalidatePath("/kiosk");
    return { ok: true, late };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Something went wrong — please see the front desk." };
  }
}

export type ExitState = { error?: string } | null;

/// Leaving Kiosk Mode takes the password of the staff account this iPad is
/// signed in as — no separate PIN to set up, share or forget.
export async function exitKioskMode(_prev: ExitState, formData: FormData): Promise<ExitState> {
  const actor = await getOsActor();
  const password = String(formData.get("password") ?? "");
  if (!password) return { error: "Enter the staff password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: actor.email, password });
  if (error) return { error: "That password isn't right." };

  await setKioskCookie(false);
  redirect("/checkin");
}
