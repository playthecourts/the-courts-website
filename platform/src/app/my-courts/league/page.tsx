import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { RsvpButtons } from "./rsvp-buttons";
import { RegisterButton } from "./register-button";
import { CancelRegistrationButton } from "./cancel-registration-button";

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function formatSessionTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export default async function LeaguePage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const guardian = await getCurrentGuardian();
  const athletes = guardian.families.flatMap((fg) => fg.family.athletes);
  const athleteIds = athletes.map((a) => a.id);

  const leaguePrograms = await prisma.program.findMany({ where: { programType: "league", active: true } });
  const leagueProgramIds = leaguePrograms.map((p) => p.id);

  const leagueOffering = await prisma.offering.findFirst({ where: { name: "Fall 2026 Basketball League" } });

  const [evalBookings, teamMemberships, registrations] = await Promise.all([
    prisma.booking.findMany({
      where: { athleteId: { in: athleteIds }, session: { programId: { in: leagueProgramIds }, team: null } },
      include: { session: true, athlete: true },
    }),
    prisma.teamMember.findMany({
      where: { athleteId: { in: athleteIds } },
      include: {
        athlete: true,
        team: {
          include: {
            program: true,
            sessions: {
              where: { startTime: { gte: new Date() } },
              orderBy: { startTime: "asc" },
              include: { bookings: { where: { athleteId: { in: athleteIds } } } },
            },
          },
        },
      },
    }),
    leagueOffering
      ? prisma.registration.findMany({
          where: { offeringId: leagueOffering.id, athleteId: { in: athleteIds }, status: { not: "cancelled" } },
        })
      : Promise.resolve([]),
  ]);

  if (leaguePrograms.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-black text-black">League</h1>
        <div className="rounded-lg border border-gray-mid bg-white p-6 text-center">
          <p className="font-display text-lg font-black text-black">No Team Yet.</p>
          <p className="mt-1 font-body text-sm text-gray-dark">League registration opens throughout the year.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-2xl font-black text-black">Fall Basketball League</h1>

      {checkout === "success" && (
        <div className="rounded-lg border border-green-600 bg-green-50 p-4 font-body text-sm text-green-800">
          Payment received — thanks! If registration still shows &ldquo;Payment Pending&rdquo; for a moment, refresh
          the page; Stripe can take a few seconds to confirm.
        </div>
      )}
      {checkout === "cancelled" && (
        <div className="rounded-lg border border-gray-mid bg-white p-4 font-body text-sm text-gray-dark">
          Checkout was cancelled — nothing was charged. You can register again whenever you&rsquo;re ready.
        </div>
      )}

      {athletes.length === 0 && (
        <div className="rounded-lg border border-gray-mid bg-white p-6 text-center">
          <p className="font-display text-lg font-black text-black">No Athletes Yet.</p>
          <p className="mt-1 font-body text-sm text-gray-dark">
            Add an athlete to your family before registering for Fall League.
          </p>
          <Link
            href="/my-courts/athletes/new"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-orange px-5 py-2.5 font-sport text-xs font-bold uppercase tracking-wide text-white"
          >
            Add an Athlete →
          </Link>
        </div>
      )}

      {athletes.map((athlete) => {
        const evalBooking = evalBookings.find((b) => b.athleteId === athlete.id);
        const membership = teamMemberships.find((tm) => tm.athleteId === athlete.id);
        const registration = registrations.find((r) => r.athleteId === athlete.id);
        const upcomingTeamSessions = membership?.team.sessions ?? [];
        const canRegister = leagueOffering && leagueOffering.stripePriceId;

        return (
          <section key={athlete.id} className="rounded-lg border border-gray-mid bg-white p-5">
            <h2 className="font-heading text-lg font-bold text-black">{athlete.firstName} {athlete.lastName}</h2>

            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-body text-sm text-gray-dark">Registration</span>
                {registration ? (
                  <span className="flex items-center gap-2">
                    <span className="font-sport text-xs font-bold uppercase tracking-wide text-orange">
                      {registration.paymentStatus === "paid" ? "Registered" : "Payment Pending"}
                    </span>
                    {registration.paymentStatus !== "paid" && canRegister && (
                      <RegisterButton athleteId={athlete.id} label="Complete Payment →" />
                    )}
                    <CancelRegistrationButton athleteId={athlete.id} />
                  </span>
                ) : canRegister ? (
                  <span className="flex items-center gap-2">
                    <span className="font-body text-sm text-gray-dark">{formatPrice(leagueOffering.priceCents ?? 37500)}</span>
                    <RegisterButton athleteId={athlete.id} />
                  </span>
                ) : (
                  <span className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">Not Open Yet</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-body text-sm text-gray-dark">Evaluation</span>
                <span className="font-sport text-xs font-bold uppercase tracking-wide text-orange">
                  {evalBooking?.status === "attended" ? "Attended" : "Not Attended"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-body text-sm text-gray-dark">Team</span>
                <span className="font-sport text-xs font-bold uppercase tracking-wide text-black">
                  {membership ? membership.team.name : "Placement Pending"}
                </span>
              </div>
            </div>

            {!registration && canRegister && (
              <p className="mt-3 border-t border-gray-mid pt-3 font-body text-xs text-gray-dark">No refunds after registration.</p>
            )}

            {upcomingTeamSessions.length > 0 && (
              <div className="mt-4 border-t border-gray-mid pt-4">
                <p className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-orange">Upcoming</p>
                <div className="flex flex-col gap-3">
                  {upcomingTeamSessions.map((s) => {
                    const booking = s.bookings.find((b) => b.athleteId === athlete.id);
                    return (
                      <div key={s.id} className="flex flex-col gap-1.5">
                        <span className="font-body text-sm text-black">{formatSessionTime(s.startTime)}</span>
                        {booking && <RsvpButtons bookingId={booking.id} current={booking.rsvpStatus} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
