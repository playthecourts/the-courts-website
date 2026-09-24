import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { CancelBookingButton } from "./cancel-booking-button";
import { GaConversionEvent } from "@/components/ga-conversion-event";

const REFUND_CUTOFF_HOURS = 12;

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

function toGCalDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function googleCalendarUrl(booking: {
  session: { startTime: Date; endTime: Date; program: { name: string } };
  athlete: { firstName: string };
}) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${booking.session.program.name} — ${booking.athlete.firstName}`,
    dates: `${toGCalDate(booking.session.startTime)}/${toGCalDate(booking.session.endTime)}`,
    location: "The Courts, 2011 Johnson Industrial Blvd., Nolensville, TN 37086",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default async function MyCourtsSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; amount?: string; item?: string; txn?: string }>;
}) {
  const { checkout, amount, item, txn } = await searchParams;
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
    include: { session: { include: { program: true, offering: true } }, athlete: true },
  });

  const byDay = new Map<string, typeof bookings>();
  for (const booking of bookings) {
    const key = booking.session.startTime.toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(booking);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-black text-black">Schedule</h1>
        {/* Always here, not just in the empty state below — once you have
            even one booking there was previously no way back to Explore
            to book another class. */}
        <a
          href="/my-courts/explore"
          className="inline-flex items-center gap-2 rounded-full bg-orange px-5 py-2.5 font-sport text-xs font-bold uppercase tracking-wide text-white"
        >
          Find a Session &rarr;
        </a>
      </div>

      {checkout === "success" && (
        <>
          <GaConversionEvent
            event="purchase"
            valueCents={amount ? Number(amount) : null}
            itemName={item ?? "Session"}
            transactionId={txn ?? null}
          />
          <p className="rounded-lg border border-orange bg-white px-4 py-3 font-body text-sm text-black">
            You&rsquo;re booked — see you then.
          </p>
        </>
      )}

      {bookings.length === 0 ? (
        <div className="rounded-2xl border border-gray-mid bg-white p-6 text-center md:p-8">
          <p className="font-display text-lg font-black text-black md:text-xl">Nothing Booked Yet</p>
          <p className="mx-auto mt-2 max-w-[46ch] font-body text-sm text-gray-dark">
            Group training, open gym, Dr. Dish and more are open for booking now. Find a session and
            grab a spot.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Array.from(byDay.entries()).map(([day, dayBookings]) => (
            <div key={day}>
              <h2 className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-orange">
                {formatDateHeading(dayBookings[0].session.startTime)}
              </h2>
              <div className="flex flex-col divide-y divide-gray-mid rounded-lg border border-gray-mid bg-white">
                {dayBookings.map((booking) => {
                  const hoursUntilStart = (booking.session.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
                  const isDropIn = booking.session.offering?.registrationMode === "session";
                  const hasMoneyOrCredit =
                    (booking.paymentStatus === "paid" && !!booking.priceChargedCents) || !!booking.creditSource;
                  const willRefund = isDropIn && hoursUntilStart >= REFUND_CUTOFF_HOURS && hasMoneyOrCredit;

                  return (
                    <div key={booking.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <span className="font-heading font-bold text-black">{booking.session.program.name}</span>
                        <span className="ml-2 font-body text-sm text-gray-dark">{booking.athlete.firstName}</span>
                        {booking.paymentStatus === "pending" && (
                          <span className="ml-2 inline-flex items-center justify-center rounded-full bg-orange/10 px-2.5 py-1 font-sport text-[11.5px] font-bold uppercase tracking-wide text-orange">
                            Payment Pending
                          </span>
                        )}
                        {booking.paymentStatus === "failed" && (
                          <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-100 px-2.5 py-1 font-sport text-[11.5px] font-bold uppercase tracking-wide text-red-600">
                            Payment Failed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-body text-sm text-gray-dark">
                          {formatTime(booking.session.startTime)}–{formatTime(booking.session.endTime)}
                        </span>
                        <a
                          href={`/my-courts/calendar/${booking.id}`}
                          className="font-sport text-[11.5px] font-bold uppercase tracking-wide text-orange"
                          title="Add to Apple/Outlook Calendar"
                        >
                          + Cal
                        </a>
                        <a
                          href={googleCalendarUrl(booking)}
                          target="_blank"
                          rel="noopener"
                          className="font-sport text-[11.5px] font-bold uppercase tracking-wide text-orange"
                          title="Add to Google Calendar"
                        >
                          + Google
                        </a>
                        <CancelBookingButton
                          bookingId={booking.id}
                          isDropIn={isDropIn}
                          hasMoneyOrCredit={hasMoneyOrCredit}
                          willRefund={willRefund}
                        />
                      </div>
                    </div>
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
