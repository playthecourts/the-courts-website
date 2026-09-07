import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getUnsignedRequiredWaivers } from "@/lib/waivers";
import { getWeeklySessionBalances } from "@/lib/entitlements";

function formatDay(date: Date, now: Date) {
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const diffDays = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / dayMs);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date);
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
        include: { session: { include: { program: true, resource: true } }, athlete: true },
        take: 8,
      })
    : [];

  const nextUp = upcomingBookings[0] ?? null;
  const thisWeekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thisWeek = upcomingBookings.filter(
    (b) => b.session.startTime <= thisWeekEnd && b.id !== nextUp?.id
  );

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
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-black text-black md:text-3xl">Hey, {firstName}.</h1>
        <p className="mt-1 font-body text-gray-dark">
          {nextUp || thisWeek.length > 0 ? "Here's what's happening at The Courts." : "Let's find your next rep."}
        </p>
      </div>

      {attentionItems.length > 0 && (
        <section className="rounded-lg border border-orange bg-white p-4">
          <p className="font-sport text-xs font-bold uppercase tracking-wide text-orange">
            One Tiny Admin Thing
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {attentionItems.map((item, i) => (
              <li key={i}>
                <Link href={item.href} className="font-body text-sm text-black underline">
                  {item.athleteName} — {item.message}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <p className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-orange">Next Up</p>
        {nextUp ? (
          <div className="rounded-lg border border-gray-mid bg-white p-5">
            <h2 className="font-display text-lg font-black text-black">
              {nextUp.session.program.name}
            </h2>
            <p className="mt-1 font-body text-sm text-gray-dark">
              {nextUp.athlete.firstName} &middot; {formatDay(nextUp.session.startTime, now)} &middot;{" "}
              {formatTime(nextUp.session.startTime)}
            </p>
            {nextUp.session.resource && (
              <p className="font-body text-sm text-gray-dark">{nextUp.session.resource.name}</p>
            )}
            <div className="mt-3 flex items-center gap-4">
              <Link
                href="/my-courts/schedule"
                className="font-sport text-xs font-bold uppercase tracking-wide text-orange"
              >
                View Details &rarr;
              </Link>
              <a
                href={`/my-courts/calendar/${nextUp.id}`}
                className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark hover:text-orange"
              >
                Add to Calendar
              </a>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-mid bg-white p-5">
            <p className="font-display text-lg font-black text-black">Court&rsquo;s Open.</p>
            <p className="mt-1 font-body text-sm text-gray-dark">Find your next training session.</p>
            <Link
              href="/my-courts/explore"
              className="mt-3 inline-block font-sport text-xs font-bold uppercase tracking-wide text-orange"
            >
              Explore Training &rarr;
            </Link>
          </div>
        )}
      </section>

      {athletes.length > 0 && (
        <section>
          <p className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-orange">Your Athletes</p>
          <div className="flex flex-col gap-2">
            {athletes.map((athlete) => (
              <Link
                key={athlete.id}
                href={`/my-courts/athletes/${athlete.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-mid bg-white px-4 py-3"
              >
                <span className="font-heading font-bold text-black">
                  {athlete.firstName} {athlete.lastName}
                </span>
                {athlete.grade && (
                  <span className="font-body text-sm text-gray-dark">Grade {athlete.grade}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-orange">Get Going</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Link href="/my-courts/explore" className="rounded-lg border border-gray-mid bg-white px-4 py-4 text-center font-sport text-xs font-bold uppercase tracking-wide text-black hover:border-orange">
            Book Training
          </Link>
          <Link href="/my-courts/explore?type=camp" className="rounded-lg border border-gray-mid bg-white px-4 py-4 text-center font-sport text-xs font-bold uppercase tracking-wide text-black hover:border-orange">
            Find a Camp
          </Link>
          <Link href="/my-courts/league" className="rounded-lg border border-gray-mid bg-white px-4 py-4 text-center font-sport text-xs font-bold uppercase tracking-wide text-black hover:border-orange">
            View League
          </Link>
          <Link href="/my-courts/explore?type=resource" className="rounded-lg border border-gray-mid bg-white px-4 py-4 text-center font-sport text-xs font-bold uppercase tracking-wide text-black hover:border-orange">
            Dr. Dish
          </Link>
        </div>
      </section>

      {thisWeek.length > 0 && (
        <section>
          <p className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-orange">This Week</p>
          <div className="flex flex-col divide-y divide-gray-mid rounded-lg border border-gray-mid bg-white">
            {thisWeek.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-heading text-sm font-bold text-black">{b.session.program.name}</p>
                  <p className="font-body text-xs text-gray-dark">{b.athlete.firstName}</p>
                </div>
                <p className="font-body text-sm text-gray-dark">
                  {formatDay(b.session.startTime, now)} &middot; {formatTime(b.session.startTime)}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/my-courts/schedule"
            className="mt-2 inline-block font-sport text-xs font-bold uppercase tracking-wide text-orange"
          >
            Full Schedule &rarr;
          </Link>
        </section>
      )}

      {upcomingEvents.length > 0 && (
        <section>
          <p className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-orange">Happening at The Courts</p>
          <div className="flex flex-col divide-y divide-gray-mid rounded-lg border border-gray-mid bg-white">
            {upcomingEvents.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <p className="font-heading text-sm font-bold text-black">{s.program.name}</p>
                <p className="font-body text-sm text-gray-dark">
                  {formatDay(s.startTime, now)} &middot; {formatTime(s.startTime)}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/my-courts/explore?type=event"
            className="mt-2 inline-block font-sport text-xs font-bold uppercase tracking-wide text-orange"
          >
            See All Events &rarr;
          </Link>
        </section>
      )}

      {planSnapshot && (
        <section>
          <p className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-orange">Your Training Plan</p>
          <div className="rounded-lg border border-gray-mid bg-white p-5">
            <p className="font-heading font-bold text-black">{planSnapshot.balance.membershipPlanName}</p>
            <p className="mt-1 font-body text-sm text-gray-dark">
              {planSnapshot.balance.quantityPerPeriod - planSnapshot.balance.usedThisWeek} of{" "}
              {planSnapshot.balance.quantityPerPeriod} sessions remaining
            </p>
            <Link
              href="/my-courts/explore"
              className="mt-3 inline-block font-sport text-xs font-bold uppercase tracking-wide text-orange"
            >
              Book Training &rarr;
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
