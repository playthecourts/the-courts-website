import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { RsvpButtons } from "./rsvp-buttons";

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

export default async function LeaguePage() {
  const guardian = await getCurrentGuardian();
  const athletes = guardian.families.flatMap((fg) => fg.family.athletes);
  const athleteIds = athletes.map((a) => a.id);

  const leaguePrograms = await prisma.program.findMany({ where: { programType: "league", active: true } });
  const leagueProgramIds = leaguePrograms.map((p) => p.id);

  const [evalBookings, teamMemberships, credits] = await Promise.all([
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
    prisma.credit.findMany({ where: { athleteId: { in: athleteIds }, creditType: "fall_league_eval_credit" } }),
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

      {athletes.map((athlete) => {
        const evalBooking = evalBookings.find((b) => b.athleteId === athlete.id);
        const membership = teamMemberships.find((tm) => tm.athleteId === athlete.id);
        const credit = credits.find((c) => c.athleteId === athlete.id);
        const upcomingTeamSessions = membership?.team.sessions ?? [];

        if (!evalBooking && !membership) return null;

        return (
          <section key={athlete.id} className="rounded-lg border border-gray-mid bg-white p-5">
            <h2 className="font-heading text-lg font-bold text-black">{athlete.firstName} {athlete.lastName}</h2>

            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-body text-sm text-gray-dark">Evaluation</span>
                <span className="font-sport text-xs font-bold uppercase tracking-wide text-orange">
                  {evalBooking?.status === "attended" ? "Complete" : evalBooking ? "Registered" : "Not Registered"}
                </span>
              </div>
              {credit && (
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm text-gray-dark">${(credit.balance / 100).toFixed(0)} League Credit</span>
                  <span className="font-sport text-xs font-bold uppercase tracking-wide text-orange">On File</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="font-body text-sm text-gray-dark">Team</span>
                <span className="font-sport text-xs font-bold uppercase tracking-wide text-black">
                  {membership ? membership.team.name : "Placement Pending"}
                </span>
              </div>
            </div>

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
