import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getUnsignedRequiredWaivers } from "@/lib/waivers";
import { getSessionBalances } from "@/lib/entitlements";
import { signedPhotoUrls } from "@/lib/athlete-photo";
import { completeness } from "@/lib/athlete";
import { familyCrewName, familyCrewInitials } from "@/lib/family";
import { unreadCountForFamily } from "@/lib/messaging";
import { AthleteAvatar } from "@/components/athlete/avatar";
import { ActionNeededStrip, AthleteRow, WhatsHappening } from "./dashboard-sections";

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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(date);
}

// The Home page IS the family's live status page — every section below reads
// real account data, no future-state placeholders. Reuses, rather than
// re-derives, the same queries the rest of the app already relies on:
// getSessionBalances (memberships/entitlements), getUnsignedRequiredWaivers +
// mediaConsent (waivers), unreadCountForFamily (messages) — one source of
// truth per fact, read from more than one place.

export default async function MyCourtsHomePage() {
  const guardian = await getCurrentGuardian();
  const family = guardian.families[0]?.family ?? null;
  const crewName = familyCrewName(family?.name);
  const initials = familyCrewInitials(family?.name);
  const athletes = family?.athletes ?? [];
  const athleteIds = athletes.map((a) => a.id);
  const now = new Date();

  // A guardian can belong to more than one family in the schema, but the
  // Parent App only ever shows the first — same assumption the rest of
  // my-courts already makes (layout.tsx, the old family/page.tsx this
  // replaces).
  const guardians = family ? [{ id: guardian.id, name: guardian.name, email: guardian.email }] : [];

  const [
    upcomingBookings,
    photoUrls,
    upcomingEvents,
    emergencyContactCounts,
    athleteMemberships,
    mediaConsents,
    unreadCount,
  ] = await Promise.all([
    athleteIds.length
      ? prisma.booking.findMany({
          where: { athleteId: { in: athleteIds }, status: { not: "cancelled" }, session: { startTime: { gte: now } } },
          orderBy: { session: { startTime: "asc" } },
          include: { session: { include: { program: true } } },
          take: 8,
        })
      : Promise.resolve([]),
    signedPhotoUrls(athletes.map((a) => a.photoPath)),
    prisma.session.findMany({
      where: { status: "scheduled", startTime: { gte: now }, program: { active: true, programType: "event" } },
      orderBy: { startTime: "asc" },
      include: { program: true },
      take: 3,
    }),
    athleteIds.length
      ? prisma.emergencyContact.groupBy({ by: ["athleteId"], where: { athleteId: { in: athleteIds } }, _count: { athleteId: true } })
      : Promise.resolve([]),
    athleteIds.length
      ? prisma.athleteMembership.findMany({
          where: { athleteId: { in: athleteIds }, status: "active" },
          include: { plan: { include: { entitlements: true } }, athlete: { select: { firstName: true } } },
        })
      : Promise.resolve([]),
    athleteIds.length
      ? prisma.mediaConsent.findMany({ where: { athleteId: { in: athleteIds } }, select: { athleteId: true } })
      : Promise.resolve([]),
    family ? unreadCountForFamily(guardian.id, [family.id]) : Promise.resolve(0),
  ]);

  const emergencyContactCountByAthlete = new Map(emergencyContactCounts.map((row) => [row.athleteId, row._count.athleteId]));

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
      nextActivity: next ? `${formatDay(next.session.startTime, now)} · ${formatTime(next.session.startTime)}` : null,
    };
  });

  // Action Needed: only what doesn't already have a natural home in one of
  // the sections below (each of those shows its own inline status instead of
  // repeating itself up here — see the Waivers+Permissions and Membership
  // sections).
  const attentionItems: { athleteName: string; message: string; href: string; cta?: string }[] = [];
  for (const athlete of athletes) {
    const { nextStep } = completeness(
      {
        goal: athlete.goal,
        coachingPreferences: athlete.coachingPreferences,
        competitiveMeter: athlete.competitiveMeter,
        emergencyContactCount: emergencyContactCountByAthlete.get(athlete.id) ?? 0,
      },
      athlete.id
    );
    if (nextStep?.key === "emergency-backup") {
      attentionItems.push({
        athleteName: athlete.firstName,
        message: "needs a Backup Emergency Contact — someone we can call if the primary guardian can't be reached",
        href: nextStep.href,
        cta: "Add Contact",
      });
    } else if (nextStep) {
      attentionItems.push({ athleteName: athlete.firstName, message: `Finish their Player Card — next: ${nextStep.label}`, href: nextStep.href, cta: "Continue" });
    }
  }
  const pastDue = await (athleteIds.length
    ? prisma.athleteMembership.findMany({ where: { athleteId: { in: athleteIds }, status: "past_due" }, include: { athlete: true, plan: true } })
    : Promise.resolve([]));
  for (const m of pastDue) {
    attentionItems.push({ athleteName: m.athlete.firstName, message: `${m.plan.name} — payment didn't go through`, href: "/my-courts/memberships" });
  }

  // Waivers + Permissions family-level roll-up — a direct consequence of the
  // same per-athlete checks the dedicated section/dashboard strip already
  // make, computed once here as a plain boolean rather than a new status
  // system. A media_no choice counts as fully answered, same as media_ok.
  let waiversComplete = athletes.length > 0;
  for (const athlete of athletes) {
    if (!waiversComplete) break;
    const unsigned = await getUnsignedRequiredWaivers(guardian.id, athlete.id);
    if (unsigned.length > 0) waiversComplete = false;
  }
  const consentedIds = new Set(mediaConsents.map((c) => c.athleteId));
  if (waiversComplete && athletes.some((a) => !consentedIds.has(a.id))) waiversComplete = false;

  const membershipRows = await Promise.all(
    athleteMemberships.map(async (m) => {
      const balances = await getSessionBalances(m.athleteId);
      const memberPricing = m.plan.entitlements.filter((e) => e.benefitType === "member_pricing");
      return { membership: m, balances, memberPricing };
    })
  );

  const happeningItems = upcomingEvents.map((s) => ({ id: s.id, name: s.program.name, dayLabel: formatDay(s.startTime, now), time: formatTime(s.startTime) }));

  const ACCOUNT_LINKS = [
    { href: "/my-courts/payments", label: "Payments" },
    { href: "/my-courts/payments", label: "Payment Methods + Billing History" },
    { href: "/my-courts/settings", label: "Family Settings" },
  ];

  return (
    <div className="flex flex-col gap-7 md:gap-9">
      {/* 1. Family Header */}
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-near-black font-display text-lg font-black text-white">
          {initials}
        </span>
        <div>
          <h1 className="font-display text-2xl font-black text-black">{crewName}</h1>
          <p className="font-body text-sm text-gray-dark">Family Account</p>
        </div>
      </div>

      <ActionNeededStrip items={attentionItems} />

      {/* 2. Membership */}
      <section>
        <p className="mb-2.5 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">Membership</p>
        {membershipRows.length > 0 ? (
          <div className="flex flex-col gap-3">
            {membershipRows.map(({ membership, balances, memberPricing }) => (
              <div key={membership.id} className="rounded-2xl border border-gray-mid bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading text-[15px] font-bold text-near-black">{membership.plan.name}</p>
                    <p className="font-body text-[12.5px] text-gray-dark">
                      {membership.athlete.firstName} &middot; ${(membership.plan.priceCents / 100).toFixed(0)}/
                      {membership.plan.billingInterval === "annual" ? "yr" : "mo"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-orange/10 px-2.5 py-1 font-sport text-[10.5px] font-bold tracking-wide text-orange uppercase">
                    {membership.status === "active" ? "Active" : membership.status.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-4 flex flex-col gap-3 border-t border-gray-mid pt-4">
                  {balances.map((b, i) => (
                    <div key={i}>
                      <p className="font-heading text-[13.5px] font-bold text-near-black">{b.membershipPlanName}</p>
                      <p className="font-body text-[13px] text-gray-dark">
                        {b.quantityPerPeriod === null
                          ? "Unlimited sessions"
                          : `${b.quantityPerPeriod - b.usedThisPeriod} of ${b.quantityPerPeriod} sessions remaining`}
                      </p>
                    </div>
                  ))}
                  {memberPricing.map((e) => (
                    <p key={e.id} className="font-body text-[13px] text-gray-dark">
                      Member rate available{e.programId ? "" : " on all programs"}
                    </p>
                  ))}
                  {membership.renewalDate && (
                    <p className="font-body text-[12px] text-gray-dark/70">
                      {membership.cancelAt ? `Cancels ${formatDate(membership.cancelAt)}` : `Next billing date: ${formatDate(membership.renewalDate)}`}
                    </p>
                  )}
                </div>
                <Link href="/my-courts/memberships" className="mt-4 inline-block font-sport text-[11px] font-bold tracking-wide text-orange uppercase">
                  Manage Membership &rarr;
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-mid bg-white px-5 py-5">
            <p className="font-heading text-[15px] font-bold text-near-black">No Active Membership Yet</p>
            <p className="mt-1 font-body text-sm text-gray-dark">Choose a membership to get started.</p>
            <Link href="/my-courts/memberships" className="mt-3 inline-flex items-center gap-2 rounded-full bg-orange px-5 py-2.5 font-sport text-[11px] font-bold tracking-wide text-white uppercase">
              View Memberships &rarr;
            </Link>
          </div>
        )}
      </section>

      {/* 3. Athletes */}
      <AthleteRow athletes={athleteCards} />
      {athletes.length > 0 && (
        <Link href="/my-courts/athletes/new" className="-mt-4 self-start font-sport text-[11px] font-bold tracking-wide text-orange uppercase">
          + Add Athlete
        </Link>
      )}

      {/* 4. Guardians */}
      <section>
        <p className="mb-2.5 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">Guardians</p>
        <div className="flex flex-col divide-y divide-gray-mid rounded-2xl border border-gray-mid bg-white">
          {guardians.map((g) => (
            <div key={g.id} className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <AthleteAvatar athlete={{ firstName: g.name, lastName: "" }} photoUrl={null} size="sm" />
                <p className="font-heading text-sm font-bold text-near-black">{g.name}</p>
              </div>
              <p className="font-body text-sm text-gray-dark">{g.email}</p>
            </div>
          ))}
        </div>
        {athletes[0] && (
          <Link href={`/my-courts/athletes/${athletes[0].id}/family-safety/guardians`} className="mt-2 inline-block font-sport text-[11px] font-bold tracking-wide text-orange uppercase">
            Manage Guardians &rarr;
          </Link>
        )}
      </section>

      {/* 5. Waivers + Permissions */}
      <section>
        <Link
          href="/my-courts/waivers"
          className={`flex items-center justify-between gap-3 rounded-2xl border px-5 py-4 transition-colors ${
            waiversComplete ? "border-gray-mid bg-white hover:border-orange" : "border-orange/40 bg-orange/5"
          }`}
        >
          <div>
            <p className="font-sport text-[13px] font-bold tracking-wide text-orange uppercase">Waivers + Permissions</p>
            {waiversComplete ? (
              <>
                <p className="mt-1 font-heading text-[15px] font-bold text-near-black">All Set &#10003;</p>
                <p className="mt-0.5 font-body text-[13px] text-gray-dark">All required waivers and permissions are complete.</p>
              </>
            ) : (
              <>
                <p className="mt-1 font-heading text-[15px] font-bold text-near-black">Action Needed</p>
                <p className="mt-0.5 font-body text-[13px] text-gray-dark">Complete required forms and manage permissions for your athletes.</p>
              </>
            )}
          </div>
          <span className="shrink-0 font-sport text-[11px] font-bold tracking-wide text-orange uppercase">
            View Waivers + Permissions &rarr;
          </span>
        </Link>
      </section>

      {/* 6. Account + Billing */}
      <section>
        <p className="mb-2.5 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">Account + Billing</p>
        <div className="flex flex-col divide-y divide-gray-mid rounded-2xl border border-gray-mid bg-white">
          {ACCOUNT_LINKS.map((link) => (
            <Link key={link.label} href={link.href} className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-gray-light">
              <span className="font-heading text-sm font-bold text-near-black">{link.label}</span>
              <span className="text-gray-dark">&rarr;</span>
            </Link>
          ))}
        </div>
        {pastDue.length > 0 && (
          <p className="mt-2 font-body text-[13px] text-danger">
            {pastDue.length} membership{pastDue.length === 1 ? "" : "s"} with a payment that didn&rsquo;t go through — see Payments.
          </p>
        )}
      </section>

      {/* 7. Messages */}
      <section>
        <Link
          href="/my-courts/messages"
          className="flex items-center justify-between gap-3 rounded-2xl border border-gray-mid bg-white px-5 py-4 transition-colors hover:border-orange"
        >
          <div>
            <p className="font-sport text-[13px] font-bold tracking-wide text-orange uppercase">Messages</p>
            <p className="mt-1 font-body text-[13.5px] text-near-black">
              {unreadCount > 0
                ? `${unreadCount} New Repl${unreadCount === 1 ? "y" : "ies"}`
                : "Questions about your athlete, membership, registration, schedule, or anything else?"}
            </p>
          </div>
          <span className="shrink-0 font-sport text-[11px] font-bold tracking-wide text-orange uppercase">
            View Messages &rarr;
          </span>
        </Link>
      </section>

      <WhatsHappening items={happeningItems} />
    </div>
  );
}
