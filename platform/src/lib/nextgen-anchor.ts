// Shared by the transfer checkout (my-courts/memberships/actions.ts) and the
// transfer card that tells the family when their first charge lands.

const MEMBERSHIP_START = new Date("2026-10-01T05:00:00.000Z");

/// A Current-NextGen family whose existing NextGen billing already lands on
/// a known day of month (staff-entered, from NextGen's own billing export)
/// keeps that same day for their Courts anchor instead of the flat Oct 1
/// everyone else gets — October has 31 days, so any day 1-31 lands validly
/// inside it. Falls back to the flat MEMBERSHIP_START anchor when unset.
///
/// Once that day has passed, the anchor rolls to the same day next month:
/// NextGen already billed the family for the current month on that day, so
/// their first Courts charge is the next one (checkout charges nothing now).
/// A day past the end of a short month lands on its last day.
export function nextGenLegacyAnchor(legacyBillingAnchorDay: number | null, now: Date = new Date()): Date {
  if (legacyBillingAnchorDay == null) return MEMBERSHIP_START;
  let year = 2026;
  let month = 9; // October, 0-based
  for (let i = 0; i < 24; i++) {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const d = new Date(Date.UTC(year, month, Math.min(legacyBillingAnchorDay, lastDay), 17));
    if (d.getTime() > now.getTime()) return d;
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }
  return MEMBERSHIP_START;
}

/// "November 1" when a family's transfer checkout will charge nothing today
/// and their first charge lands on a future billing day; null otherwise.
export function nextGenFirstChargeLabel(legacyBillingAnchorDay: number | null | undefined): string | null {
  if (legacyBillingAnchorDay == null) return null;
  const anchor = nextGenLegacyAnchor(legacyBillingAnchorDay);
  if (anchor.getTime() <= Date.now()) return null;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(anchor);
}
