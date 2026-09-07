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
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-black text-black">Schedule</h1>

      {bookings.length === 0 ? (
        <div className="rounded-lg border border-gray-mid bg-white p-6 text-center">
          <p className="font-display text-lg font-black text-black">Suspiciously Quiet.</p>
          <p className="mt-1 font-body text-sm text-gray-dark">There&rsquo;s nothing on the calendar yet.</p>
          <a
            href="/my-courts/explore"
            className="mt-3 inline-block font-sport text-xs font-bold uppercase tracking-wide text-orange"
          >
            Find Something to Do &rarr;
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Array.from(byDay.entries()).map(([day, dayBookings]) => (
            <div key={day}>
              <h2 className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-orange">
                {formatDateHeading(dayBookings[0].session.startTime)}
              </h2>
              <div className="flex flex-col divide-y divide-gray-mid rounded-lg border border-gray-mid bg-white">
                {dayBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <span className="font-heading font-bold text-black">{booking.session.program.name}</span>
                      <span className="ml-2 font-body text-sm text-gray-dark">{booking.athlete.firstName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-body text-sm text-gray-dark">
                        {formatTime(booking.session.startTime)}–{formatTime(booking.session.endTime)}
                      </span>
                      <a
                        href={`/my-courts/calendar/${booking.id}`}
                        className="font-sport text-[10px] font-bold uppercase tracking-wide text-orange"
                        title="Add to Calendar"
                      >
                        + Cal
                      </a>
                    </div>
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
