import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuardianAthleteOrNull } from "@/lib/athlete-profile";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/athlete";

function formatSessionTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export default async function AthleteSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const athlete = await getGuardianAthleteOrNull(id);
  if (!athlete) notFound();

  const bookings = await prisma.booking.findMany({
    where: {
      athleteId: athlete.id,
      status: { not: "cancelled" },
      session: { startTime: { gte: new Date() } },
    },
    orderBy: { session: { startTime: "asc" } },
    include: { session: { include: { program: true } } },
  });

  return (
    <div>
      {bookings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-mid bg-white p-5 text-center">
          <p className="font-heading text-[15px] font-bold text-near-black">Nothing booked yet</p>
          <p className="mt-1.5 font-body text-[13.5px] text-gray-dark">
            Find something for {displayName(athlete)} to jump into.
          </p>
          <Link
            href="/my-courts/explore"
            className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-orange px-5 font-sport text-[13px] font-bold uppercase tracking-wide text-white hover:bg-orange-hover"
          >
            Explore Programs
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-mid overflow-hidden rounded-xl border border-gray-mid bg-white">
          {bookings.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
              <p className="font-heading text-[14.5px] font-bold text-near-black">
                {b.session.program.name}
              </p>
              <p className="shrink-0 font-body text-[13.5px] text-gray-dark">
                {formatSessionTime(b.session.startTime)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
