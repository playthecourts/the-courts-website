// Date/time helpers for the Coach App.
//
// Times are formatted in UTC, matching what the Parent App and /admin already
// do (see my-courts/page.tsx). The platform stores session times as wall-clock
// values in UTC, so formatting in UTC is what displays "5:00 PM" for a 5 PM
// session. This is a whole-platform convention, not a Coach App choice — if it
// is ever changed to real timezone handling it must change everywhere at once.

const TZ = "UTC";

export function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  }).format(date);
}

export function formatTimeRange(start: Date, end: Date) {
  return `${formatTime(start)}–${formatTime(end)}`;
}

export function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: TZ,
  }).format(date);
}

export function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: TZ,
  }).format(date);
}

export function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: TZ }).format(date);
}

/** Start of the given day, in the UTC wall-clock convention above. */
export function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function endOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

export function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

/** "Today" / "Tomorrow" / "Sat, Oct 10" — for agenda grouping. */
export function relativeDayLabel(date: Date, now: Date) {
  const diff = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return formatShortDate(date);
}

/** Grade shown compactly on roster rows: "4th Grade". */
export function formatGrade(grade: string | null) {
  if (!grade) return null;
  return /grade/i.test(grade) ? grade : `${grade} Grade`;
}

export function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** Minutes-since-midnight → "5:00 PM", for availability blocks. */
export function formatMinuteOfDay(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
