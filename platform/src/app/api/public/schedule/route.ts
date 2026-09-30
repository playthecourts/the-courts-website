import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gradeRangeLabel } from "@/lib/programs/types";
import { PARENT_VISIBLE } from "@/lib/programs/parent-feed";

// Public dated schedule for playthecourts.com.
//
// Families asked for the real calendar, not a representative week: the exact
// day, who is coaching it, what is on tomorrow, and which days the building is
// closed. So this returns real occurrences with their dates rather than a
// weekly rollup, plus whole-facility closures over the same window.
//
// Visibility is not decided here: it is the Parent App's predicate, so what
// playthecourts.com lists and what a signed-in family sees in Explore cannot
// disagree.
//
// The app stores session times as wall-clock instants and formats them in UTC
// everywhere (coach-format.ts, the booking calendar, the session cards): a 9am
// class is stored 09:00Z and read back as 9am. Anything here that turns a time
// into text does the same, so the website and the portal can never disagree
// about when a class starts.

export const dynamic = "force-dynamic";

const TZ = "UTC";
const DEFAULT_DAYS = 120;
const MAX_DAYS = 400;

function corsOrigin(request: Request): string {
  const origin = request.headers.get("origin") ?? "";
  const allowed = [
    "https://playthecourts.com",
    "https://www.playthecourts.com",
    ...(process.env.NODE_ENV === "development"
      ? ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000"]
      : []),
  ];
  return allowed.includes(origin) ? origin : "https://playthecourts.com";
}

const dayKey = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

function clock(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true })
      .formatToParts(d).map((x) => [x.type, x.value])
  );
  return `${p.hour}:${p.minute} ${p.dayPeriod}`.replace(/ /g, " ");
}

// Camps and open gyms are often filed under a program with no sport set, and a
// null sport drops out of the website's sport filter. The name is unambiguous
// where the column is empty, so read it rather than lose the card.
function sportFromName(name: string | null): string | null {
  const n = (name ?? "").toLowerCase();
  if (n.includes("basketball")) return "Basketball";
  if (n.includes("volleyball")) return "Volleyball";
  return null;
}

const weekday = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" }).format(d);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const now = new Date();

  const from = url.searchParams.get("from") ? new Date(`${url.searchParams.get("from")}T00:00:00Z`) : new Date(`${dayKey(now)}T00:00:00Z`);
  const days = Math.min(Number(url.searchParams.get("days") ?? DEFAULT_DAYS) || DEFAULT_DAYS, MAX_DAYS);
  const to = url.searchParams.get("to")
    ? new Date(`${url.searchParams.get("to")}T23:59:59Z`)
    : new Date(from.getTime() + days * 86_400_000);

  const [sessions, blocks] = await Promise.all([
    prisma.session.findMany({
      where: {
        status: "scheduled",
        startTime: { gte: from, lte: to },
        // The website is a parent-facing surface, so it reads the SAME
        // predicate the Parent App does (PARENT_VISIBLE in parent-feed.ts)
        // rather than a second visibleWebsite flag. Curating two lists is
        // how the public schedule drifted from the app in the first place:
        // staff publish to the app, the website silently keeps showing three
        // classes. One switch now governs both. Unlike Explore, this does not
        // drop registrationMode !== "session" — that rule exists to hide a
        // per-session Book button that would throw, and camps and League
        // practices still belong on a public calendar.
        offering: PARENT_VISIBLE,
      },
      orderBy: { startTime: "asc" },
      select: {
        id: true, startTime: true, endTime: true, title: true, publicNote: true,
        offering: {
          select: {
            id: true, name: true, shortDescription: true, websiteCta: true,
            gradeMin: true, gradeMax: true,
            program: { select: { name: true, sport: true, programType: true } },
          },
        },
        coaches: { select: { role: true, staff: { select: { name: true } } } },
      },
    }),
    // resourceId null is the whole building — a holiday or a snow day, not one
    // court going down for maintenance.
    prisma.facilityBlock.findMany({
      where: { resourceId: null, startTime: { lte: to }, endTime: { gte: from } },
      orderBy: { startTime: "asc" },
      select: { startTime: true, endTime: true, reason: true, note: true },
    }),
  ]);

  const classes = sessions.map((s) => {
    const o = s.offering!;
    const lead = s.coaches.find((c) => c.role === "lead") ?? s.coaches[0];
    const coach = lead?.staff.name ?? null;
    return {
      id: s.id,
      date: dayKey(s.startTime),
      day: weekday(s.startTime),
      time: clock(s.startTime),
      endTime: clock(s.endTime),
      minutes: Math.round((s.endTime.getTime() - s.startTime.getTime()) / 60000),
      title: s.title ?? o.name ?? o.program.name,
      sport: o.program.sport ?? sportFromName(s.title ?? o.name ?? o.program.name),
      type: o.program.programType,
      desc: o.shortDescription,
      note: s.publicNote,
      ages: gradeRangeLabel(o.gradeMin, o.gradeMax),
      // The placeholder for an unconfirmed coach is not a person's name.
      coach: coach === "Staff Member" ? null : coach,
      cta: o.websiteCta ?? "Book",
      bookingUrl: `https://app.playthecourts.com/my-courts/explore?offering=${o.id}`,
    };
  });

  // Flattened per day, but NOT flattened to "closed". A two-hour Saturday
  // maintenance block is not a closed Saturday, and saying so on the public
  // calendar would tell families not to come to a class that is running. So
  // each day carries the block's real hours and an allDay flag; only allDay
  // blanks a date. Anything shorter is a notice shown beside that day's
  // classes.
  const DAY_MS = 86_400_000;
  const closures: {
    date: string; reason: string; note: string | null;
    from: string; to: string; allDay: boolean;
  }[] = [];
  for (const b of blocks) {
    for (let t = new Date(`${dayKey(b.startTime)}T00:00:00Z`); t <= b.endTime; t = new Date(t.getTime() + DAY_MS)) {
      const d = dayKey(t);
      if (t < from || t > to) continue;
      if (closures.some((c) => c.date === d && c.allDay)) continue;

      // How much of THIS calendar day the block actually covers.
      const dayStart = new Date(`${d}T00:00:00Z`);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      const covStart = b.startTime > dayStart ? b.startTime : dayStart;
      const covEnd = b.endTime < dayEnd ? b.endTime : dayEnd;
      // A closure is entered against opening hours, not midnight-to-midnight:
      // Christmas reads 6:00 AM-10:00 PM. 12h covers any full operating day
      // while leaving a cleaning window or a private party as a partial.
      const covered = covEnd.getTime() - covStart.getTime();
      const allDay = covered >= 12 * 3_600_000;

      const existing = closures.findIndex((c) => c.date === d);
      const entry = {
        date: d, reason: b.reason, note: b.note,
        from: clock(covStart), to: clock(covEnd), allDay,
      };
      if (existing >= 0) closures[existing] = entry;
      else closures.push(entry);
    }
  }

  return NextResponse.json(
    {
      generatedAt: now.toISOString(),
      from: dayKey(from),
      to: dayKey(to),
      count: classes.length,
      classes,
      closures,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Access-Control-Allow-Origin": corsOrigin(request),
        Vary: "Origin",
      },
    }
  );
}
