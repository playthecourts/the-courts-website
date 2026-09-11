import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getUnsignedRequiredWaivers } from "@/lib/waivers";
import { signedPhotoUrls } from "@/lib/athlete-photo";
import {
  ActionNeededStrip,
  AthleteRow,
  WelcomeHero,
  WhatsHappening,
} from "./dashboard-sections";

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
        include: {
          session: {
            include: { program: true, resource: true, coaches: { include: { staff: true } } },
          },
          athlete: true,
        },
        take: 8,
      })
    : [];

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

  const happeningItems = upcomingEvents.map((s) => ({
    id: s.id,
    name: s.program.name,
    dayLabel: formatDay(s.startTime, now),
    time: formatTime(s.startTime),
  }));

  return (
    <div className="flex flex-col gap-7 md:gap-9">
      <WelcomeHero firstName={firstName} />

      <ActionNeededStrip items={attentionItems} />

      <AthleteRow athletes={athleteCards} />

      <WhatsHappening items={happeningItems} />
    </div>
  );
}
