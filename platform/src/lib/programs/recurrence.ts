// ---------------------------------------------------------------------------
// Occurrence generation.
//
// Pure functions: no database, no Prisma, no clock beyond what is passed in.
// The scheduling engine calls expandSchedule() to turn an admin's intent
// ("every Tuesday, 5-6pm, Oct 6 through Dec 15") into the exact list of
// occurrences that will become Session rows — and the SAME call powers the
// "you're about to create 11 sessions" preview. Preview and create cannot
// disagree, because they are the same function.
//
// Time model: every occurrence is built in UTC from wall-clock parts, matching
// how the existing schema stores session times (see admin/programs/actions.ts).
// The Courts is one physical facility in one timezone; a wall-clock 5pm is
// stored as 17:00Z and rendered back with timeZone: "UTC" everywhere. That is
// a deliberate simplification, not an oversight — it is wrong only if The
// Courts opens a second facility in another timezone, and it is written down
// here so that day is a search away.
// ---------------------------------------------------------------------------

/// 0 = Sunday, matching Date.getUTCDay() and the existing entitlements week.
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type ScheduleKind = "one_time" | "recurring" | "multi_day" | "season" | "custom";

/// A single day's time window, as wall-clock minutes from midnight.
export type TimeWindow = {
  /// Minutes from midnight, e.g. 17 * 60 = 1020 for 5:00 PM.
  startMinute: number;
  durationMinutes: number;
};

export type RecurrenceFrequency = "weekly" | "biweekly";

export type ScheduleSpec =
  | {
      kind: "one_time";
      /// "YYYY-MM-DD"
      date: string;
      window: TimeWindow;
    }
  | {
      kind: "recurring";
      startDate: string;
      /// Inclusive. Either endDate or occurrenceCount must be set, not both.
      endDate?: string;
      occurrenceCount?: number;
      frequency: RecurrenceFrequency;
      weekdays: Weekday[];
      window: TimeWindow;
    }
  | {
      kind: "multi_day";
      /// Consecutive days, inclusive of both ends — a camp runs Oct 12-15.
      startDate: string;
      endDate: string;
      window: TimeWindow;
      /// Camps usually skip weekends; leave true to include every calendar day.
      includeWeekends?: boolean;
    }
  | {
      kind: "custom";
      /// Explicit dates, each with its own window — irregular league games,
      /// holiday clinics, anything that isn't a pattern.
      dates: { date: string; window?: TimeWindow }[];
      /// Applied to any date that doesn't carry its own window.
      window: TimeWindow;
    };

export type Occurrence = {
  startTime: Date;
  endTime: Date;
  /// 1-based position in the generated series. Becomes Session.dayIndex for
  /// multi-day camps ("Day 3") and is otherwise informational.
  index: number;
};

export class ScheduleSpecError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScheduleSpecError";
  }
}

/// Hard ceiling on one generation. A typo in "occurrences" should produce an
/// error an admin can read, not 40,000 session rows in the live database.
export const MAX_OCCURRENCES = 400;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateUTC(date: string, field: string): Date {
  if (!DATE_RE.test(date)) {
    throw new ScheduleSpecError(`${field} must be a YYYY-MM-DD date (got "${date}").`);
  }
  const [y, m, d] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  // Catches Feb 30 and friends, which Date.UTC silently rolls forward.
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) {
    throw new ScheduleSpecError(`${field} is not a real date (got "${date}").`);
  }
  return parsed;
}

function validateWindow(window: TimeWindow, field: string) {
  if (!Number.isInteger(window.startMinute) || window.startMinute < 0 || window.startMinute > 1439) {
    throw new ScheduleSpecError(`${field} start time must be within a single day.`);
  }
  if (!Number.isInteger(window.durationMinutes) || window.durationMinutes <= 0) {
    throw new ScheduleSpecError(`${field} needs a duration longer than zero minutes.`);
  }
  if (window.durationMinutes > 24 * 60) {
    throw new ScheduleSpecError(`${field} cannot run longer than 24 hours.`);
  }
}

function occurrenceAt(day: Date, window: TimeWindow, index: number): Occurrence {
  const startTime = new Date(day.getTime() + window.startMinute * 60_000);
  const endTime = new Date(startTime.getTime() + window.durationMinutes * 60_000);
  return { startTime, endTime, index };
}

function addDays(day: Date, days: number): Date {
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/// Turns an admin's scheduling intent into the exact occurrences it produces.
/// Throws ScheduleSpecError with an admin-readable message rather than
/// returning a partial list — a half-built series is worse than a refusal.
export function expandSchedule(spec: ScheduleSpec): Occurrence[] {
  switch (spec.kind) {
    case "one_time": {
      validateWindow(spec.window, "This session's");
      return [occurrenceAt(parseDateUTC(spec.date, "Date"), spec.window, 1)];
    }

    case "recurring": {
      validateWindow(spec.window, "This session's");
      if (spec.weekdays.length === 0) {
        throw new ScheduleSpecError("Pick at least one day of the week.");
      }
      if (!spec.endDate && !spec.occurrenceCount) {
        throw new ScheduleSpecError("Set an end date or a number of sessions.");
      }
      if (spec.endDate && spec.occurrenceCount) {
        throw new ScheduleSpecError(
          "Set an end date or a number of sessions — not both, so it's unambiguous where the series stops."
        );
      }

      const start = parseDateUTC(spec.startDate, "Start date");
      const end = spec.endDate ? parseDateUTC(spec.endDate, "End date") : null;
      if (end && end < start) {
        throw new ScheduleSpecError("End date is before the start date.");
      }
      if (spec.occurrenceCount !== undefined) {
        if (!Number.isInteger(spec.occurrenceCount) || spec.occurrenceCount < 1) {
          throw new ScheduleSpecError("Number of sessions must be at least 1.");
        }
        if (spec.occurrenceCount > MAX_OCCURRENCES) {
          throw new ScheduleSpecError(
            `That would create ${spec.occurrenceCount} sessions. The limit is ${MAX_OCCURRENCES} — split it into separate offerings.`
          );
        }
      }

      const wanted = new Set(spec.weekdays);
      // Biweekly counts weeks from the week containing startDate, so "every
      // other Tuesday" stays on the same alternating週 even when the series
      // starts mid-week.
      const weekStride = spec.frequency === "biweekly" ? 2 : 1;
      const seriesWeekStart = addDays(start, -start.getUTCDay());

      const out: Occurrence[] = [];
      let cursor = start;
      // Bound the walk independently of the exit conditions so a malformed
      // spec can never spin forever.
      const maxDays = MAX_OCCURRENCES * 7 * weekStride + 14;

      for (let dayCount = 0; dayCount <= maxDays; dayCount++) {
        if (end && cursor > end) break;
        if (spec.occurrenceCount && out.length >= spec.occurrenceCount) break;

        if (wanted.has(cursor.getUTCDay() as Weekday)) {
          const weeksIn = Math.floor(
            (cursor.getTime() - seriesWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)
          );
          if (weeksIn % weekStride === 0) {
            out.push(occurrenceAt(cursor, spec.window, out.length + 1));
            if (out.length > MAX_OCCURRENCES) {
              throw new ScheduleSpecError(
                `That pattern creates more than ${MAX_OCCURRENCES} sessions. Shorten the date range.`
              );
            }
          }
        }
        cursor = addDays(cursor, 1);
      }

      if (out.length === 0) {
        throw new ScheduleSpecError(
          "That pattern doesn't produce any sessions — check the days of the week against the date range."
        );
      }
      if (spec.occurrenceCount && out.length < spec.occurrenceCount) {
        throw new ScheduleSpecError(
          `Only ${out.length} of the ${spec.occurrenceCount} sessions fit before the pattern ran out.`
        );
      }
      return out;
    }

    case "multi_day": {
      validateWindow(spec.window, "Each day's");
      const start = parseDateUTC(spec.startDate, "Start date");
      const end = parseDateUTC(spec.endDate, "End date");
      if (end < start) throw new ScheduleSpecError("End date is before the start date.");

      const out: Occurrence[] = [];
      for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
        const dow = cursor.getUTCDay();
        if (!spec.includeWeekends && (dow === 0 || dow === 6)) continue;
        out.push(occurrenceAt(cursor, spec.window, out.length + 1));
        if (out.length > MAX_OCCURRENCES) {
          throw new ScheduleSpecError(`That range is longer than ${MAX_OCCURRENCES} days.`);
        }
      }
      if (out.length === 0) {
        throw new ScheduleSpecError(
          "That range contains no days — it may be a weekend-only range with weekends excluded."
        );
      }
      return out;
    }

    case "custom": {
      validateWindow(spec.window, "The default");
      if (spec.dates.length === 0) throw new ScheduleSpecError("Add at least one date.");
      if (spec.dates.length > MAX_OCCURRENCES) {
        throw new ScheduleSpecError(`That's more than ${MAX_OCCURRENCES} dates.`);
      }
      const seen = new Set<string>();
      const out: Occurrence[] = [];
      for (const entry of spec.dates) {
        const window = entry.window ?? spec.window;
        validateWindow(window, `${entry.date}'s`);
        const day = parseDateUTC(entry.date, "Date");
        const key = `${entry.date}:${window.startMinute}`;
        if (seen.has(key)) {
          throw new ScheduleSpecError(`${entry.date} is listed twice at the same time.`);
        }
        seen.add(key);
        out.push(occurrenceAt(day, window, out.length + 1));
      }
      out.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      return out.map((o, i) => ({ ...o, index: i + 1 }));
    }
  }
}

/// Two occurrences of the same offering landing on the same court at the same
/// time is a spec bug, not a facility conflict — catching it here keeps the
/// conflict report about real clashes with OTHER programming.
export function findSelfOverlaps(occurrences: Occurrence[]): [Occurrence, Occurrence][] {
  const sorted = [...occurrences].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const clashes: [Occurrence, Occurrence][] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startTime < sorted[i - 1].endTime) {
      clashes.push([sorted[i - 1], sorted[i]]);
    }
  }
  return clashes;
}

// --- Formatting helpers, shared by the preview UI and notification copy. ---

export function formatMinuteOfDay(minute: number): string {
  const h24 = Math.floor(minute / 60);
  const m = minute % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12}:00 ${suffix}` : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function describeSchedule(spec: ScheduleSpec): string {
  const w = spec.kind === "custom" ? spec.window : spec.window;
  const time = `${formatMinuteOfDay(w.startMinute)}–${formatMinuteOfDay(
    (w.startMinute + w.durationMinutes) % (24 * 60)
  )}`;
  switch (spec.kind) {
    case "one_time":
      return `${spec.date} · ${time}`;
    case "recurring": {
      const days = spec.weekdays
        .slice()
        .sort()
        .map((d) => WEEKDAY_LABELS[d])
        .join(", ");
      const every = spec.frequency === "biweekly" ? "Every other" : "Every";
      const until = spec.endDate ? `through ${spec.endDate}` : `· ${spec.occurrenceCount} sessions`;
      return `${every} ${days} · ${time} · from ${spec.startDate} ${until}`;
    }
    case "multi_day":
      return `${spec.startDate} – ${spec.endDate} · ${time} daily`;
    case "custom":
      return `${spec.dates.length} selected date${spec.dates.length === 1 ? "" : "s"} · ${time}`;
  }
}
