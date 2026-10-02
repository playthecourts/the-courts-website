// The one clock for anything compared against a class time.
//
// Session times are stored as Central wall-clock values in UTC fields: a 5 PM
// class on Oct 1 is 2026-10-01T17:00Z (see coach-format.ts). Comparing them
// against the real `new Date()` is off by the Central offset (5–6 hours), so
// after ~7 PM a screen thinks it's tomorrow, classes "end" hours early, and
// the 12-hour refund cutoff lands ~17 hours out.
//
// Use facilityNow() wherever a moment is compared with, or a "today" is
// derived for, session/booking times. Keep the real `new Date()` for real
// timestamps (createdAt, Stripe, audit logs, expiry clocks).
//
// No "server-only": the parent booking calendar uses this in the browser.

const FACILITY_TZ = "America/Chicago";

/** Central time right now, as a UTC-wall-clock Date comparable to session times. */
export function facilityNow(now: Date = new Date()): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: FACILITY_TZ,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return new Date(`${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}.${String(now.getMilliseconds()).padStart(3, "0")}Z`);
}

/** Midnight at the start of today in Central, in the wall-clock convention. */
export function facilityToday(now: Date = new Date()): Date {
  const n = facilityNow(now);
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/** Today's date in Central as YYYY-MM-DD. */
export function facilityTodayKey(now: Date = new Date()): string {
  return facilityToday(now).toISOString().slice(0, 10);
}
