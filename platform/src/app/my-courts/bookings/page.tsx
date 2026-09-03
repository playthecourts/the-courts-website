import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getBookingEligibility, type BookingEligibility } from "@/lib/entitlements";
import { SessionBookingRow } from "./session-booking-row";

export default async function BookingsPage() {
  const guardian = await getCurrentGuardian();
  const athletes = guardian.families.flatMap((fg) => fg.family.athletes);
  const athleteIds = athletes.map((a) => a.id);

  const sessions = await prisma.session.findMany({
    where: { status: "scheduled", startTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
    include: {
      program: true,
      // "not cancelled" rather than "booked" only: an attended/no_show
      // booking still held a seat, so it must still count toward capacity
      // and still show as this athlete's existing booking.
      bookings: { where: { athleteId: { in: athleteIds }, status: { not: "cancelled" } } },
      waitlistEntries: { where: { athleteId: { in: athleteIds }, status: "waiting" } },
      _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } },
    },
  });

  // Precomputed before render — eligibility is only a decision aid for a
  // seat not yet taken, so this only runs for genuinely open athlete/session
  // pairs, not the full sessions x athletes cross product.
  const eligibilityByKey = new Map<string, BookingEligibility>();
  for (const session of sessions) {
    for (const athlete of athletes) {
      const alreadyHasSeat = session.bookings.some((b) => b.athleteId === athlete.id);
      const alreadyWaitlisted = session.waitlistEntries.some((w) => w.athleteId === athlete.id);
      if (!alreadyHasSeat && !alreadyWaitlisted) {
        const eligibility = await getBookingEligibility(athlete.id, session.id);
        eligibilityByKey.set(`${session.id}:${athlete.id}`, eligibility);
      }
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">Book a Session</h1>
      <p className="mb-6 text-sm text-neutral-600">
        {athletes.length === 0
          ? "No athletes on file yet."
          : `Booking for: ${athletes.map((a) => a.firstName).join(", ")}`}
      </p>

      {sessions.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing open for booking right now.</p>
      ) : (
        <div className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {sessions.map((session) => (
            <div key={session.id} className="px-4 py-4">
              <div className="mb-2 flex items-baseline justify-between">
                <div>
                  <p className="font-medium">{session.program.name}</p>
                  <p className="text-sm text-neutral-500">
                    {new Intl.DateTimeFormat("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: "UTC",
                    }).format(session.startTime)}
                  </p>
                </div>
                <p className="text-sm text-neutral-500">
                  {session._count.bookings}/{session.capacity}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {athletes.map((athlete) => {
                  const booking = session.bookings.find((b) => b.athleteId === athlete.id);
                  const waitlistEntry = session.waitlistEntries.find(
                    (w) => w.athleteId === athlete.id
                  );
                  const isFull = session._count.bookings >= session.capacity;
                  const eligibility = eligibilityByKey.get(`${session.id}:${athlete.id}`) ?? null;

                  return (
                    <SessionBookingRow
                      key={athlete.id}
                      athleteId={athlete.id}
                      athleteName={athlete.firstName}
                      sessionId={session.id}
                      bookingId={booking?.id ?? null}
                      waitlistEntryId={waitlistEntry?.id ?? null}
                      isFull={isFull}
                      eligibility={eligibility}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
