import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gradeRangeLabel } from "@/lib/programs/types";

// Public weekly class schedule for playthecourts.com.
//
// The marketing schedule page used to carry a hand-written copy of the week,
// which drifted the moment anything moved in Courts OS — a coach swap, a
// cancelled week, a new class. This is the same idea as the programs feed:
// what families see on the website is what the app actually has scheduled.
//
// Real occurrences are collapsed back into a weekly grid, because that is what
// the page shows. A class appears once per weekday/time/name, dated by its next
// real occurrence, with the coach actually assigned to that occurrence.
// Cancelled sessions are excluded, so a cancelled week drops out on its own.

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const TZ = "America/Chicago";
const LOOKAHEAD_DAYS = 21;

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

/// Weekday and clock time as read in Nashville, not in UTC — a 7:00 PM class
/// is 01:00 UTC the next day, which would land it on the wrong row.
function localParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, weekday: "long", hour: "numeric", minute: "2-digit", hour12: true,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  // Always ":00" on the hour — the marketing page parses these strings back
  // into minutes to sort a day's rows, and "7 PM" would not parse there.
  return {
    day: parts.weekday as string,
    time: `${parts.hour}:${parts.minute} ${parts.dayPeriod}`.replace(/ /g, " "),
    sortKey: Number(
      new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false })
        .formatToParts(d).filter((p) => p.type === "hour" || p.type === "minute").map((p) => p.value).join("")
    ),
  };
}

export async function GET(request: Request) {
  const now = new Date();
  const until = new Date(now.getTime() + LOOKAHEAD_DAYS * 86_400_000);

  const sessions = await prisma.session.findMany({
    where: {
      status: "scheduled",
      startTime: { gte: now, lte: until },
      offering: { status: "published", visibleWebsite: true, internalOnly: false },
    },
    orderBy: { startTime: "asc" },
    select: {
      startTime: true,
      endTime: true,
      title: true,
      offering: {
        select: {
          id: true, name: true, shortDescription: true, websiteCta: true,
          gradeMin: true, gradeMax: true,
          program: { select: { name: true, sport: true, programType: true } },
        },
      },
      coaches: { select: { role: true, staff: { select: { name: true } } } },
    },
  });

  // One row per weekday + start time + class name. The first occurrence wins,
  // so the coach shown is whoever is actually running it next.
  const seen = new Map<string, Record<string, unknown>>();
  for (const s of sessions) {
    const o = s.offering;
    if (!o) continue;
    const { day, time, sortKey } = localParts(s.startTime);
    const name = s.title ?? o.name ?? o.program.name;
    const key = `${day}|${sortKey}|${name}`;
    if (seen.has(key)) continue;

    const lead = s.coaches.find((c) => c.role === "lead") ?? s.coaches[0];
    const coach = lead?.staff.name ?? null;

    seen.set(key, {
      day,
      time,
      sortKey,
      title: name,
      sport: o.program.sport,
      type: o.program.programType,
      desc: o.shortDescription,
      ages: gradeRangeLabel(o.gradeMin, o.gradeMax),
      minutes: Math.round((s.endTime.getTime() - s.startTime.getTime()) / 60000),
      // "Staff Member" is the placeholder for an unconfirmed coach — better to
      // show nothing on the website than a name that isn't a person.
      coach: coach === "Staff Member" ? null : coach,
      nextDate: s.startTime,
      cta: o.websiteCta ?? "Book",
      bookingUrl: `https://app.playthecourts.com/my-courts/explore?offering=${o.id}`,
    });
  }

  const classes = [...seen.values()].sort((a, b) => {
    const da = DAYS.indexOf(a.day as typeof DAYS[number]);
    const db = DAYS.indexOf(b.day as typeof DAYS[number]);
    // Monday-first, the way the page reads.
    const ra = (da + 6) % 7, rb = (db + 6) % 7;
    return ra - rb || (a.sortKey as number) - (b.sortKey as number);
  });

  return NextResponse.json(
    { generatedAt: now.toISOString(), lookaheadDays: LOOKAHEAD_DAYS, count: classes.length, classes },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        "Access-Control-Allow-Origin": corsOrigin(request),
        Vary: "Origin",
      },
    }
  );
}
