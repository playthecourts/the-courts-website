// Quarter maths for progress reports.
//
// Quarters are DERIVED from dates, never rows an admin has to create. There is
// no quarters table and no yearly setup task: Q1 is Jan–Mar for every year that
// will ever exist, so the label for a date is a pure function of the date.

export type Quarter = { year: number; quarter: number };

export function quarterFor(date: Date = new Date()): Quarter {
  return { year: date.getUTCFullYear(), quarter: Math.floor(date.getUTCMonth() / 3) + 1 };
}

export function quarterLabel(q: Quarter): string {
  return `Q${q.quarter} ${q.year}`;
}

/// Inclusive start, exclusive end — the window a report's participation and
/// session counts are drawn from.
export function quarterRange(q: Quarter): { start: Date; end: Date } {
  const startMonth = (q.quarter - 1) * 3;
  return {
    start: new Date(Date.UTC(q.year, startMonth, 1)),
    end: new Date(Date.UTC(q.year, startMonth + 3, 1)),
  };
}

export function previousQuarter(q: Quarter): Quarter {
  return q.quarter === 1 ? { year: q.year - 1, quarter: 4 } : { year: q.year, quarter: q.quarter - 1 };
}

/// Sorts newest first — the order the Progress tab shows reports in.
export function compareQuartersDesc(a: Quarter, b: Quarter): number {
  return b.year - a.year || b.quarter - a.quarter;
}

/// The quarter a coach is writing about right now. During the first weeks of a
/// new quarter the useful default is usually the one that just ended, so this
/// returns the previous quarter for the first 14 days.
export function reportingQuarter(now: Date = new Date()): Quarter {
  const current = quarterFor(now);
  const { start } = quarterRange(current);
  const daysIn = (now.getTime() - start.getTime()) / 86_400_000;
  return daysIn < 14 ? previousQuarter(current) : current;
}
