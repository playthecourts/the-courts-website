import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getBookingEligibility, type BookingEligibility } from "@/lib/entitlements";
import { SessionBookingRow } from "./session-booking-row";

const TYPE_LABELS: Record<string, string> = {
  class: "Group Training",
  camp: "Camp",
  league: "League",
  resource: "Dr. Dish",
  private: "Private Training",
  rental: "Rental",
  event: "Special Event",
};

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

const DATE_RANGES: Record<string, () => { gte: Date; lt?: Date }> = {
  today: () => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return { gte: now, lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
  },
  tomorrow: () => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return { gte: start, lt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
  },
  week: () => ({ gte: new Date(), lt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }),
  weekend: () => {
    const now = new Date();
    const day = now.getUTCDay(); // 0 = Sunday
    const daysUntilSat = (6 - day + 7) % 7;
    const satStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilSat));
    return { gte: now, lt: new Date(satStart.getTime() + 2 * 24 * 60 * 60 * 1000) };
  },
};
const DATE_LABELS: Record<string, string> = { today: "Today", tomorrow: "Tomorrow", week: "This Week", weekend: "This Weekend" };

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; type?: string; when?: string }>;
}) {
  const { sport, type, when } = await searchParams;
  const guardian = await getCurrentGuardian();
  const athletes = guardian.families.flatMap((fg) => fg.family.athletes);
  const athleteIds = athletes.map((a) => a.id);

  const availableSports = await prisma.program.findMany({
    where: { active: true, sport: { not: null } },
    distinct: ["sport"],
    select: { sport: true },
  });

  const dateRange = when && DATE_RANGES[when] ? DATE_RANGES[when]() : { gte: new Date() };

  const sessions = await prisma.session.findMany({
    where: {
      status: "scheduled",
      startTime: dateRange,
      program: {
        active: true,
        ...(sport ? { sport } : {}),
        ...(type ? { programType: type as never } : {}),
      },
    },
    orderBy: { startTime: "asc" },
    include: {
      program: true,
      bookings: { where: { athleteId: { in: athleteIds }, status: { not: "cancelled" } } },
      waitlistEntries: { where: { athleteId: { in: athleteIds }, status: "waiting" } },
      _count: { select: { bookings: { where: { status: { not: "cancelled" } } } } },
    },
  });

  const eligibilityByKey = new Map<string, BookingEligibility>();
  for (const session of sessions) {
    for (const athlete of athletes) {
      const alreadyHasSeat = session.bookings.some((b) => b.athleteId === athlete.id);
      const alreadyWaitlisted = session.waitlistEntries.some((w) => w.athleteId === athlete.id);
      if (!alreadyHasSeat && !alreadyWaitlisted) {
        eligibilityByKey.set(`${session.id}:${athlete.id}`, await getBookingEligibility(athlete.id, session.id));
      }
    }
  }

  function chipHref(next: { sport?: string; type?: string; when?: string }) {
    const params = new URLSearchParams();
    const s = next.sport !== undefined ? next.sport : sport;
    const t = next.type !== undefined ? next.type : type;
    const w = next.when !== undefined ? next.when : when;
    if (s) params.set("sport", s);
    if (t) params.set("type", t);
    if (w) params.set("when", w);
    const qs = params.toString();
    return `/my-courts/explore${qs ? `?${qs}` : ""}`;
  }

  function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
    return (
      <Link
        href={href}
        className={`min-h-[36px] rounded-full border px-4 py-1.5 font-sport text-xs font-bold uppercase tracking-wide ${
          active ? "border-black bg-black text-white" : "border-gray-mid bg-white text-gray-dark hover:border-orange"
        }`}
      >
        {children}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-black text-black">Find Your Next Rep.</h1>
        <p className="mt-1 font-body text-sm text-gray-dark">
          {athletes.length === 0
            ? "No athletes on file yet."
            : `Booking for: ${athletes.map((a) => a.firstName).join(", ")}`}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Chip href={chipHref({ sport: undefined })} active={!sport}>All Sports</Chip>
          {availableSports.map((p) =>
            p.sport ? (
              <Chip key={p.sport} href={chipHref({ sport: p.sport })} active={sport === p.sport}>
                {p.sport}
              </Chip>
            ) : null
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip href={chipHref({ type: undefined })} active={!type}>All Types</Chip>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <Chip key={value} href={chipHref({ type: value })} active={type === value}>
              {label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip href={chipHref({ when: undefined })} active={!when}>Anytime</Chip>
          {Object.entries(DATE_LABELS).map(([value, label]) => (
            <Chip key={value} href={chipHref({ when: value })} active={when === value}>
              {label}
            </Chip>
          ))}
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-gray-mid bg-white p-6 text-center">
          <p className="font-display text-lg font-black text-black">Nothing on the Board.</p>
          <p className="mt-1 font-body text-sm text-gray-dark">Try another sport or type.</p>
          <Link
            href="/my-courts/explore"
            className="mt-3 inline-block font-sport text-xs font-bold uppercase tracking-wide text-orange"
          >
            Clear Filters
          </Link>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-gray-mid rounded-lg border border-gray-mid bg-white">
          {sessions.map((session) => {
            const spotsLeft = session.capacity - session._count.bookings;
            return (
              <div key={session.id} className="px-4 py-4">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <div>
                    <p className="font-sport text-[11px] font-bold uppercase tracking-wide text-orange">
                      {session.program.sport ? `${session.program.sport} · ` : ""}
                      {TYPE_LABELS[session.program.programType] ?? session.program.programType}
                    </p>
                    <p className="font-heading font-bold text-black">{session.program.name}</p>
                    <p className="font-body text-sm text-gray-dark">{formatSessionTime(session.startTime)}</p>
                  </div>
                  <p className="whitespace-nowrap font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">
                    {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left` : "Full"}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {athletes.map((athlete) => {
                    const booking = session.bookings.find((b) => b.athleteId === athlete.id);
                    const waitlistEntry = session.waitlistEntries.find((w) => w.athleteId === athlete.id);
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
            );
          })}
        </div>
      )}
    </div>
  );
}
