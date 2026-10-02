import "server-only";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Check-in: the one place "this athlete is here" gets written, shared by the
// Front Desk screen (staff tap a name) and the lobby Kiosk (a kid taps their
// own name). It writes the same AttendanceRecord the Coach App's Here/Late/
// Absent buttons write, so a check-in at the door shows up on the coach's
// roster with no second system to reconcile.
//
// Time convention (see coach-format.ts): sessions are stored as UTC wall-clock
// — a 5 PM class on Oct 1 is 2026-10-01T17:00Z. So "now" has to be expressed
// the same way before it's compared to a session's start or end.
// ---------------------------------------------------------------------------

const TZ = "America/Chicago";

/// Central time right now, as a UTC-wall-clock Date comparable to session times.
export function wallNow(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return new Date(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`);
}

export function todayRange() {
  const now = wallNow();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start, end: new Date(start.getTime() + 86_400_000), now };
}

/// Kids can check themselves in from this long before class until it ends.
export const SELF_CHECKIN_OPENS_MIN = 60;
/// Checked in more than this long after start counts as Late.
const LATE_AFTER_MIN = 10;

/// Today's classes with who is booked and who is in. `kioskOnly` narrows to
/// classes a kid could check into right now, and to the minimum a lobby
/// screen may show: first name and last initial, nothing else.
export async function todaysClasses({ kioskOnly = false }: { kioskOnly?: boolean } = {}) {
  const { start, end, now } = todayRange();
  const sessions = await prisma.session.findMany({
    where: {
      status: "scheduled",
      startTime: kioskOnly ? { gte: start, lte: new Date(now.getTime() + SELF_CHECKIN_OPENS_MIN * 60_000) } : { gte: start, lt: end },
      ...(kioskOnly ? { endTime: { gt: now } } : {}),
    },
    orderBy: { startTime: "asc" },
    select: {
      id: true, title: true, startTime: true, endTime: true, capacity: true,
      offering: { select: { name: true } },
      program: { select: { name: true, sport: true } },
      coaches: { select: { staff: { select: { name: true } } } },
      bookings: {
        where: { status: { not: "cancelled" } },
        orderBy: { athlete: { firstName: "asc" } },
        select: {
          id: true, status: true, paymentStatus: true,
          attendance: { select: { status: true, checkedInAt: true, note: true } },
          athlete: { select: { id: true, firstName: true, nickname: true, lastName: true, grade: true, hasMedicalInfo: true, hasCustodyRestrictions: true } },
        },
      },
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    name: s.title ?? s.offering?.name ?? s.program.name,
    sport: s.program.sport,
    startTime: s.startTime,
    endTime: s.endTime,
    capacity: s.capacity,
    coach: s.coaches.map((c) => c.staff.name.split(" ")[0]).join(", "),
    athletes: s.bookings.map((b) => {
      const first = b.athlete.nickname?.trim() || b.athlete.firstName;
      const here = b.attendance?.status === "present" || b.attendance?.status === "late";
      return {
        bookingId: b.id,
        athleteId: b.athlete.id,
        // The kiosk never sends a full surname to a lobby screen.
        kioskName: `${first} ${b.athlete.lastName.charAt(0)}.`,
        fullName: `${first} ${b.athlete.lastName}`,
        grade: b.athlete.grade,
        paymentDue: b.paymentStatus === "due" || b.paymentStatus === "pending",
        // Desk-only safety flags (existence, never detail). Forced false for
        // the kiosk so they can't reach a lobby screen even by a later mapping change.
        health: kioskOnly ? false : b.athlete.hasMedicalInfo,
        pickupRestriction: kioskOnly ? false : b.athlete.hasCustodyRestrictions,
        here,
        late: b.attendance?.status === "late",
        absent: b.attendance?.status === "absent" || b.attendance?.status === "excused",
        selfCheckedIn: here && b.attendance?.note === SELF_NOTE,
        checkedInAt: b.attendance?.checkedInAt ?? null,
      };
    }),
  }));
}

export type TodaysClass = Awaited<ReturnType<typeof todaysClasses>>[number];

const SELF_NOTE = "Self check-in";

/// Marks one booking as here. `source` decides the note, and for the kiosk the
/// session must be open for self check-in right now — a kid can't check into
/// tomorrow's class, or one that ended an hour ago.
export async function checkInBooking(bookingId: string, staffId: string, source: "desk" | "kiosk") {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { status: true, session: { select: { startTime: true, endTime: true, status: true } } },
  });
  if (!booking || booking.status === "cancelled") throw new Error("That booking isn't active anymore.");
  if (booking.session.status !== "scheduled") throw new Error("That class isn't running today.");

  const { start, end, now } = todayRange();
  const st = booking.session.startTime;
  if (st < start || st >= end) throw new Error("You can only check in to today's classes.");
  if (source === "kiosk") {
    const opens = new Date(st.getTime() - SELF_CHECKIN_OPENS_MIN * 60_000);
    if (now < opens || now >= booking.session.endTime) throw new Error("Check-in for this class isn't open right now — ask the front desk.");
  }

  // Only a kid tapping in at the kiosk can be "late" — that time is when they
  // actually walked in. A staff check-in is often entered after the fact
  // (catching up mid-class), so its time says nothing about arrival.
  const late = source === "kiosk" && now.getTime() > st.getTime() + LATE_AFTER_MIN * 60_000;
  const status = late ? ("late" as const) : ("present" as const);
  const note = source === "kiosk" ? SELF_NOTE : null;
  const checkedInAt = new Date();

  await prisma.$transaction([
    prisma.attendanceRecord.upsert({
      where: { bookingId },
      create: { bookingId, status, checkedInAt, recordedById: staffId, note },
      update: { status, checkedInAt, recordedById: staffId, recordedAt: checkedInAt, note },
    }),
    prisma.booking.update({ where: { id: bookingId }, data: { status: "attended" } }),
  ]);
  return { late };
}

/// Front desk only: takes back a check-in tapped by mistake.
export async function undoCheckIn(bookingId: string) {
  await prisma.$transaction([
    prisma.attendanceRecord.deleteMany({ where: { bookingId } }),
    prisma.booking.update({ where: { id: bookingId }, data: { status: "booked" } }),
  ]);
}

export function formatClassTime(d: Date) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(d);
}
