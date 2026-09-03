import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

function formatDateHeading(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export default async function MyCourtsSchedulePage() {
  const guardian = await getCurrentGuardian();
  const athletes = guardian.families.flatMap((fg) => fg.family.athletes);
  const athleteIds = athletes.map((a) => a.id);

  const bookings = await prisma.booking.findMany({
    where: {
      athleteId: { in: athleteIds },
      // Not just "booked": if attendance was already marked (e.g. admin
      // marks it right at session start), the booking shouldn't vanish
      // from "upcoming" just because its status moved to attended/no_show.
      status: { not: "cancelled" },
      session: { startTime: { gte: new Date() } },
    },
    orderBy: { session: { startTime: "asc" } },
    include: { session: { include: { program: true } }, athlete: true },
  });

  const byDay = new Map<string, typeof bookings>();
  for (const booking of bookings) {
    const key = booking.session.startTime.toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(booking);
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">Schedule</h1>

      {bookings.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nothing booked yet.{" "}
          <a href="/my-courts/bookings" className="underline">
            Book a session →
          </a>
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {Array.from(byDay.entries()).map(([day, dayBookings]) => (
            <div key={day}>
              <h2 className="mb-2 text-sm font-semibold text-neutral-700">
                {formatDateHeading(dayBookings[0].session.startTime)}
              </h2>
              <div className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200">
                {dayBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <span className="font-medium">{booking.session.program.name}</span>
                      <span className="ml-2 text-neutral-500">{booking.athlete.firstName}</span>
                    </div>
                    <span className="text-neutral-500">
                      {formatTime(booking.session.startTime)}–{formatTime(booking.session.endTime)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
