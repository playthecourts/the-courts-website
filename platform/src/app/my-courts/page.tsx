import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getUnsignedRequiredWaivers } from "@/lib/waivers";
import { getWeeklySessionBalances } from "@/lib/entitlements";
import { signedPhotoUrls } from "@/lib/athlete-photo";
import { displayName } from "@/lib/athlete";
import {
  ActionNeededStrip,
  AthleteRow,
  ExplorePanel,
  QuickLinks,
  UpNextCard,
  WelcomeHero,
} from "./dashboard-sections";

function formatDay(date: Date, now: Date) {
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const diffDays = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / dayMs);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date);
}

function formatDayNumber(date: Date) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "UTC" }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(date);
}

export default async function MyCourtsHomePage() {
  const guardian = await getCurrentGuardian();
  const firstName = guardian.name.split(" ")[0];
  const athletes = guardian.families.flatMap((fg) => fg.family.athletes);
  const athleteIds = athletes.map((a) => a.id);
  const now = new Date();

  const upcomingBookings = athleteIds.length
    ? await prisma.booking.findMany({
        where: {
          athleteId: { in: athleteIds },
          status: { not: "cancelled" },
          session: { startTime: { gte: now } },
        },
        orderBy: { session: { startTime: "asc" } },
        include: {
          session: {
            include: { program: true, resource: true, coaches: { include: { staff: true } } },
          },
          athlete: true,
        },
        take: 8,
      })
    : [];

  const nextUpBooking = upcomingBookings[0] ?? null;
  const thisWeekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thisWeek = upcomingBookings.filter(
    (b) => b.session.startTime <= thisWeekEnd && b.id !== nextUpBooking?.id
  );

  const nextUp = nextUpBooking
    ? {
        programName: nextUpBooking.session.program.name,
        sport: nextUpBooking.session.program.sport,
        athleteName: displayName(nextUpBooking.athlete),
        coachName: nextUpBooking.session.coaches[0]?.staff.name.split(" ")[0] ?? null,
        dayLabel: formatDay(nextUpBooking.session.startTime, now),
        dayNumber: formatDayNumber(nextUpBooking.session.startTime),
        time: formatTime(nextUpBooking.session.startTime),
        location: nextUpBooking.session.resource?.name ?? null,
      }
    : null;

  const photoUrls = await signedPhotoUrls(athletes.map((a) => a.photoPath));
  const athleteCards = athletes.map((athlete) => {
    const next = upcomingBookings.find((b) => b.athleteId === athlete.id);
    return {
      id: athlete.id,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      nickname: athlete.nickname,
      grade: athlete.grade,
      sports: athlete.sports,
      photoUrl: athlete.photoPath ? (photoUrls.get(athlete.photoPath) ?? null) : null,
      nextActivity: next
        ? `${formatDay(next.session.startTime, now)} · ${formatTime(next.session.startTime)}`
        : null,
    };
  });

  // Upcoming special events, regardless of whether this family has
  // registered yet — a discovery/promo section, not a personal schedule one.
  const upcomingEvents = await prisma.session.findMany({
    where: { status: "scheduled", startTime: { gte: now }, program: { active: true, programType: "event" } },
    orderBy: { startTime: "asc" },
    include: { program: true },
    take: 3,
  });

  // Needs Your Attention: real conditions only — unsigned required waivers
  // per athlete, and any membership Stripe marked past_due.
  const attentionItems: { athleteName: string; message: string; href: string }[] = [];
  for (const athlete of athletes) {
    const unsigned = await getUnsignedRequiredWaivers(guardian.id, athlete.id);
    for (const waiver of unsigned) {
      attentionItems.push({
        athleteName: athlete.firstName,
        message: `Waiver needed: ${waiver.waiverType}`,
        href: "/my-courts/waivers",
      });
    }
  }
  if (athleteIds.length) {
    const pastDue = await prisma.athleteMembership.findMany({
      where: { athleteId: { in: athleteIds }, status: "past_due" },
      include: { athlete: true, plan: true },
    });
    for (const m of pastDue) {
      attentionItems.push({
        athleteName: m.athlete.firstName,
        message: `${m.plan.name} — payment didn't go through`,
        href: "/my-courts/memberships",
      });
    }
  }

  // Training Plan snapshot: first athlete carrying a session-based plan.
  let planSnapshot: { athleteName: string; balance: Awaited<ReturnType<typeof getWeeklySessionBalances>>[number] } | null = null;
  for (const athlete of athletes) {
    const balances = await getWeeklySessionBalances(athlete.id);
    if (balances.length > 0) {
      planSnapshot = { athleteName: athlete.firstName, balance: balances[0] };
      break;
    }
  }

  return (
    <div className="flex flex-col gap-7 md:gap-9">
      <WelcomeHero firstName={firstName} />

      <ActionNeededStrip items={attentionItems} />

      <UpNextCard nextUp={nextUp} />

      <ExplorePanel />

      <AthleteRow athletes={athleteCards} />

      <QuickLinks />

      {thisWeek.length > 0 && (
        <section>
          <p className="mb-2.5 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
            This Week
          </p>
          <div className="flex flex-col divide-y divide-gray-mid rounded-2xl bg-white">
            {thisWeek.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="font-heading text-sm font-bold text-near-black">{b.session.program.name}</p>
                  <p className="font-body text-xs text-gray-dark">{displayName(b.athlete)}</p>
                </div>
                <p className="font-body text-sm text-gray-dark">
                  {formatDay(b.session.startTime, now)} &middot; {formatTime(b.session.startTime)}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/my-courts/schedule"
            className="mt-2.5 inline-block font-sport text-xs font-bold tracking-wide text-orange uppercase"
          >
            Full Schedule &rarr;
          </Link>
        </section>
      )}

      {upcomingEvents.length > 0 && (
        <section>
          <p className="mb-2.5 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
            Happening at The Courts
          </p>
          <div className="flex flex-col divide-y divide-gray-mid rounded-2xl bg-white">
            {upcomingEvents.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-3.5">
                <p className="font-heading text-sm font-bold text-near-black">{s.program.name}</p>
                <p className="font-body text-sm text-gray-dark">
                  {formatDay(s.startTime, now)} &middot; {formatTime(s.startTime)}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/my-courts/explore?type=event"
            className="mt-2.5 inline-block font-sport text-xs font-bold tracking-wide text-orange uppercase"
          >
            See All Events &rarr;
          </Link>
        </section>
      )}

      {planSnapshot && (
        <section>
          <p className="mb-2.5 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
            Your Training Plan
          </p>
          <div className="rounded-2xl bg-white p-5">
            <p className="font-heading font-bold text-near-black">{planSnapshot.balance.membershipPlanName}</p>
            <p className="mt-1 font-body text-sm text-gray-dark">
              {planSnapshot.balance.quantityPerPeriod - planSnapshot.balance.usedThisWeek} of{" "}
              {planSnapshot.balance.quantityPerPeriod} sessions remaining
            </p>
            <Link
              href="/my-courts/explore"
              className="mt-3 inline-block font-sport text-xs font-bold tracking-wide text-orange uppercase"
            >
              Book Training &rarr;
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
