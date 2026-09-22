import type { ReactNode } from "react";
import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { formatGrade } from "@/lib/coach-format";
import { RsvpButtons } from "./rsvp-buttons";
import { LeaguePaymentForm } from "./payment-form";
import { CancelRegistrationButton } from "./cancel-registration-button";
import { FinishMembershipSetupButton } from "./finish-membership-setup-button";

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

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(date);
}

function Pill({ tone, children }: { tone: "in" | "pending" | "placed" | "neutral"; children: ReactNode }) {
  const toneClasses: Record<string, string> = {
    in: "bg-green-100 text-green-800",
    pending: "bg-orange/10 text-orange",
    placed: "bg-green-100 text-green-800",
    neutral: "bg-gray-light text-gray-dark",
  };
  return (
    <span className={`inline-block shrink-0 rounded-full px-2.5 py-1 font-sport text-[10.5px] font-bold tracking-wide uppercase ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

const WHATS_AHEAD = (
  <div className="flex flex-col gap-1.5 font-body text-sm text-gray-dark">
    <p><span className="font-bold text-black">Practices begin Thursday, October 8.</span> Practices are on Thursdays.</p>
    <p><span className="font-bold text-black">First games: October 24.</span> Saturday games are played at WNSL locations throughout West Nashville and Brentwood.</p>
  </div>
);

const SEASON_INCLUDES = [
  "8 team practices",
  "7 regular-season Saturday games",
  "Courts coaching throughout the season",
  "Tournament opportunity for qualifying teams",
];

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

  const [evalBookings, evalAttendanceRecords, teamMemberships, registrations] = await Promise.all([
    prisma.booking.findMany({
      where: { athleteId: { in: athleteIds }, session: { programId: { in: leagueProgramIds }, team: null } },
      include: { session: true, athlete: true },
    }),
    prisma.evalAttendanceRecord.findMany({ where: { matchedAthleteId: { in: athleteIds } } }),
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

  const canRegister = !!(leagueOffering && leagueOffering.stripePriceId);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl font-black text-black sm:text-4xl">2026 Fall Basketball League</h1>
      </div>

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
        const attended =
          evalBooking?.status === "attended" ||
          evalAttendanceRecords.some((r) => r.matchedAthleteId === athlete.id);
        const membership = teamMemberships.find((tm) => tm.athleteId === athlete.id);
        const registration = registrations.find((r) => r.athleteId === athlete.id);
        const upcomingTeamSessions = membership?.team.sessions ?? [];
        const nextTeamSession = upcomingTeamSessions[0];
        const grade = formatGrade(athlete.grade);
        const isPaid = registration?.paymentStatus === "paid";

        return (
          <section key={athlete.id} className="rounded-xl border border-gray-mid bg-white p-5">
            <div>
              <h2 className="font-heading text-lg font-bold text-black">{athlete.firstName} {athlete.lastName}</h2>
              {grade && <p className="font-body text-sm text-gray-dark">{grade}</p>}
            </div>

            {/* State 1 — not registered */}
            {!registration && (
              <div className="mt-4 flex flex-col gap-5">
                <div>
                  <p className="font-heading text-base font-bold text-black">{athlete.firstName} Isn&rsquo;t Registered Yet</p>
                  <p className="mt-0.5 font-body text-sm text-gray-dark">Want in for Fall?</p>
                  {canRegister ? (
                    <div className="mt-3">
                      <LeaguePaymentForm athleteId={athlete.id} />
                    </div>
                  ) : (
                    <p className="mt-3 font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">Not Open Yet</p>
                  )}
                </div>

                <div className="border-t border-gray-mid pt-4">
                  <p className="mb-2 font-sport text-[11px] font-bold uppercase tracking-wide text-orange">What&rsquo;s Included</p>
                  <ul className="flex flex-col gap-1 font-body text-sm text-gray-dark">
                    {SEASON_INCLUDES.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-gray-mid pt-4">
                  <p className="mb-2 font-sport text-[11px] font-bold uppercase tracking-wide text-orange">What&rsquo;s Ahead</p>
                  {WHATS_AHEAD}
                  <p className="mt-1 font-body text-sm text-gray-dark">Practice times are TBD and will be shared after team placement.</p>
                </div>
              </div>
            )}

            {/* States 2 & 3 — registration started or complete */}
            {registration && (
              <div className="mt-4 flex flex-col gap-5">
                <div>
                  <p className="font-heading text-base font-bold text-black">{athlete.firstName}&rsquo;s Season Status</p>
                </div>

                <div className="flex flex-col gap-4">
                  {/* Registration */}
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-sport text-[11px] font-bold uppercase tracking-wide text-gray-dark">Registration</p>
                      <Pill tone={isPaid ? "in" : "pending"}>{isPaid ? "You're In ✓" : "Payment Pending"}</Pill>
                    </div>
                    <p className="mt-1 font-body text-sm text-gray-dark">
                      {isPaid
                        ? `${athlete.firstName} is registered for Fall League.`
                        : "Your spot is almost locked in. Complete payment to finish registration."}
                    </p>
                    {!isPaid && canRegister && (
                      <div className="mt-2 flex flex-col gap-3">
                        <LeaguePaymentForm athleteId={athlete.id} />
                        <CancelRegistrationButton athleteId={athlete.id} />
                      </div>
                    )}
                  </div>

                  {/* Membership setup — only shown for the rare case where the
                      League payment succeeded but the bundled membership
                      subscription failed to create (see registration.
                      membershipSetupNeeded). The League seat is already paid
                      for either way. */}
                  {registration.membershipSetupNeeded && (
                    <div className="border-t border-gray-mid pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-sport text-[11px] font-bold uppercase tracking-wide text-gray-dark">Membership</p>
                        <Pill tone="pending">Setup Needed</Pill>
                      </div>
                      <p className="mt-1 font-body text-sm text-gray-dark">
                        {athlete.firstName}&rsquo;s League payment went through, but we hit a snag setting up the
                        membership it requires. No new card needed — we&rsquo;ll use the one already on file.
                      </p>
                      <div className="mt-2">
                        <FinishMembershipSetupButton registrationId={registration.id} />
                      </div>
                    </div>
                  )}

                  {/* Evaluation */}
                  <div className="border-t border-gray-mid pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-sport text-[11px] font-bold uppercase tracking-wide text-gray-dark">Evaluation</p>
                      <Pill tone={attended ? "in" : "neutral"}>{attended ? "Evaluation Complete ✓" : "Not Attended"}</Pill>
                    </div>
                    <p className="mt-1 font-body text-sm text-gray-dark">
                      {attended
                        ? "Thanks for coming out — this helps our coaches with placement."
                        : "No worries. Our coaching team will follow up to make sure we have what we need for placement."}
                    </p>
                  </div>

                  {/* Team Placement */}
                  <div className="border-t border-gray-mid pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-sport text-[11px] font-bold uppercase tracking-wide text-gray-dark">Team Placement</p>
                      <Pill tone={membership ? "placed" : "neutral"}>{membership ? "Placed ✓" : "Pending"}</Pill>
                    </div>
                    {membership ? (
                      <div className="mt-1 font-body text-sm text-gray-dark">
                        <p className="font-bold text-black">
                          {membership.team.division ?? membership.team.name}
                        </p>
                        {nextTeamSession && (
                          <>
                            <p>Practice Day: {formatWeekday(nextTeamSession.startTime)}</p>
                            <p>Practice Time: {formatTime(nextTeamSession.startTime)}</p>
                          </>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1 font-body text-sm text-gray-dark">
                        Teams will be finalized after registration closes based on grade, skill level, and roster balance.
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-mid pt-4">
                  <p className="mb-2 font-sport text-[11px] font-bold uppercase tracking-wide text-orange">What&rsquo;s Ahead</p>
                  {WHATS_AHEAD}
                  <p className="mt-2 font-body text-xs text-gray-dark">
                    {SEASON_INCLUDES.join(" · ")}
                  </p>
                </div>
              </div>
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
