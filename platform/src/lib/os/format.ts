// Display helpers shared across Courts OS. Kept in one place so a date never
// renders two different ways on two screens.

const TZ = "America/Chicago"; // The Courts is in Nolensville, TN.

export function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  if (cents === 0) return "Free";
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export function moneyExact(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function time(d: Date): string {
  return d
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: TZ,
    })
    .replace(":00", "");
}

export function timeRange(start: Date, end: Date): string {
  return `${time(start)}–${time(end)}`;
}

export function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: TZ,
  });
}

export function shortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ });
}

export function shortDateTime(d: Date): string {
  return `${shortDate(d)}, ${time(d)}`;
}

export function weekdayShort(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", timeZone: TZ });
}

/// "in 2 days" / "3 days ago" — used by the attention queue, where relative
/// urgency reads faster than an absolute date.
export function relative(d: Date, now = new Date()): string {
  const ms = d.getTime() - now.getTime();
  const days = Math.round(ms / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export function gradeRange(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  const f = (n: number) => {
    if (n === 0) return "K";
    const s = ["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4)] ?? "th";
    return `${n}${s}`;
  };
  if (min !== null && max !== null) return min === max ? `${f(min)} Grade` : `${f(min)}–${f(max)} Grade`;
  if (min !== null) return `${f(min)}+ Grade`;
  return `Up to ${f(max!)} Grade`;
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/// Start/end of a day in the facility's timezone, returned as UTC instants.
export function dayBounds(d: Date): { start: Date; end: Date } {
  const y = d.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
  const start = new Date(`${y}T00:00:00`);
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

/// Monday-start week containing `d`.
export function weekBounds(d: Date): { start: Date; end: Date } {
  const { start: dayStart } = dayBounds(d);
  const dow = (dayStart.getDay() + 6) % 7; // Mon=0
  const start = new Date(dayStart.getTime() - dow * 86_400_000);
  return { start, end: new Date(start.getTime() + 7 * 86_400_000) };
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

export function toDateInput(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

/// Minutes since midnight, for positioning blocks on the facility grid.
export function minutesInto(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    timeZone: TZ,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export const PROGRAM_TYPE_LABELS: Record<string, string> = {
  class: "Group Training",
  camp: "Camp",
  league: "League",
  resource: "Dr. Dish",
  private: "Private Training",
  rental: "Court Rental",
  event: "Special Event",
};

export const REGISTRATION_STATUS_LABELS: Record<string, string> = {
  started: "Started",
  incomplete: "Incomplete",
  registered: "Registered",
  waitlisted: "Waitlisted",
  cancelled: "Cancelled",
  admin_review: "Admin Review",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  none: "No Charge",
  due: "Payment Due",
  pending: "Payment Pending",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partially Refunded",
};
