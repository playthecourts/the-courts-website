import "server-only";
import { cookies } from "next/headers";

// Kiosk Mode lock. When this cookie is set, proxy.ts sends every page on this
// device to /kiosk — typing /os or /checkin in the address bar just lands back
// on the self check-in screen. Only /kiosk/exit (staff password) clears it.
//
// The iPad stays signed in as the staff member who turned Kiosk Mode on; the
// cookie is what keeps that staff session from being usable by anyone at the
// lobby screen. Pair it with iPad Guided Access so Safari can't be left either.
export const KIOSK_COOKIE = "courts_kiosk";

export async function isKioskDevice() {
  return (await cookies()).get(KIOSK_COOKIE)?.value === "1";
}

export async function setKioskCookie(on: boolean) {
  const jar = await cookies();
  if (on) {
    jar.set(KIOSK_COOKIE, "1", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    jar.delete(KIOSK_COOKIE);
  }
}
