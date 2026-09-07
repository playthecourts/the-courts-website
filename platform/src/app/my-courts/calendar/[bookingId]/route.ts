import { NextResponse } from "next/server";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

function toICSDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

// Folds long lines and escapes text per RFC 5545 — Outlook/Apple/Google all
// expect CRLF line endings and commas/semicolons/newlines escaped in text fields.
function escapeICSText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(_request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const guardian = await getCurrentGuardian();
  const athleteIds = guardian.families.flatMap((fg) => fg.family.athletes.map((a) => a.id));

  const booking = await prisma.booking.findFirst({
    // Ownership check — never trust the URL param alone for a minor's schedule.
    where: { id: bookingId, athleteId: { in: athleteIds } },
    include: { session: { include: { program: true, resource: true } }, athlete: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { session, athlete } = booking;
  const summary = escapeICSText(`${session.program.name} — ${athlete.firstName}`);
  const location = session.resource ? escapeICSText(`The Courts — ${session.resource.name}`) : escapeICSText("The Courts");
  const description = escapeICSText("2011 Johnson Industrial Blvd., Nolensville, TN 37086");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Courts//Parent App//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${booking.id}@playthecourts.com`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(session.startTime)}`,
    `DTEND:${toICSDate(session.endTime)}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="the-courts-${athlete.firstName.toLowerCase()}.ics"`,
    },
  });
}
