import { facilityNow } from "@/lib/facility-time";
import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getSessionBalances } from "@/lib/entitlements";
import { signedPhotoUrls } from "@/lib/athlete-photo";
import { getParentActionNeeded } from "@/lib/parent-action-needed";
import { familyCrewName, familyCrewInitials } from "@/lib/family";
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
// getSessionBalances (memberships/entitlements), and getParentActionNeeded
// for the one Action Needed list at the top — one source of truth per fact.

export default async function MyCourtsHomePage() {
  const guardian = await getCurrentGuardian();
  const family = guardian.families[0]?.family ?? null;
  const crewName = familyCrewName(family?.name);
  const initials = familyCrewInitials(family?.name);
  const athletes = family?.athletes ?? [];
  const athleteIds = athletes.map((a) => a.id);
  const now = facilityNow();

  // A guardian can belong to more than one family in the schema, but the
  // Parent App only ever shows the first — same assumption the rest of
  // my-courts already makes (layout.tsx, the old family/page.tsx this
  // replaces).
  const guardians = family ? [{ id: guardian.id, name: guardian.name, email: guardian.email }] : [];

  const [
    upcomingBookings,
    photoUrls,
    upcomingEvents,
    athleteMemberships,
    actionItems,
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
      ? prisma.athleteMembership.findMany({
          where: { athleteId: { in: athleteIds }, status: "active" },
          include: { plan: { include: { entitlements: true } }, athlete: { select: { firstName: true } } },
        })
      : Promise.resolve([]),
    getParentActionNeeded(guardian),
  ]);

  // Purchased session packs (Dr. Dish 10-pack, a drop-in pack) — a separate
  // one-time purchase, not a Training Plan benefit, so it's tracked here
  // rather than folded into the membership balances above.
  const activeCredits = athleteIds.length
    ? await prisma.credit.findMany({
        where: { athleteId: { in: athleteIds }, status: "issued", balance: { gt: 0 } },
        include: { athlete: { select: { firstName: true } } },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const CREDIT_TYPE_LABEL: Record<string, string> = {
    dr_dish_ten_pack: "Dr. Dish 10-Pack",
    drop_in_pack: "Drop-In Credits",
  };

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

  const membershipRows = await Promise.all(
    athleteMemberships.map(async (m) => {
      const balances = await getSessionBalances(m.athleteId);
      const memberPricing = m.plan.entitlements.filter((e) => e.benefitType === "member_pricing");
      return { membership: m, balances, memberPricing };
    })
  );

  const happeningItems = upcomingEvents.map((s) => ({ id: s.id, name: s.program.name, dayLabel: formatDay(s.startTime, now), time: formatTime(s.startTime) }));

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

      {/* Action Needed — first thing on Home, the one place for anything
          unfinished (waivers, payments, held spots, profile gaps). */}
      <ActionNeededStrip items={actionItems} />

      {/* 2. Membership */}
      <section>
        <p className="mb-2.5 font-sport text-[14px] font-bold tracking-wide text-orange uppercase">Membership</p>
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
                  <span className="shrink-0 rounded-full bg-orange/10 px-2.5 py-1 font-sport text-[11.5px] font-bold tracking-wide text-orange uppercase">
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
                <Link href="/my-courts/memberships" className="mt-4 inline-block font-sport text-xs font-bold tracking-wide text-orange uppercase">
                  Manage Membership &rarr;
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-mid bg-white px-5 py-5">
            <p className="font-heading text-[15px] font-bold text-near-black">No Active Membership Yet</p>
            <p className="mt-1 font-body text-sm text-gray-dark">Choose a membership to get started.</p>
            <Link href="/my-courts/memberships" className="mt-3 inline-flex items-center gap-2 rounded-full bg-orange px-5 py-2.5 font-sport text-xs font-bold tracking-wide text-white uppercase">
              View Memberships &rarr;
            </Link>
          </div>
        )}
      </section>

      {/* Purchased session packs — a one-time buy, not a membership benefit,
          so it's its own small block rather than folded into Membership. */}
      {activeCredits.length > 0 && (
        <section>
          <p className="mb-2.5 font-sport text-[14px] font-bold tracking-wide text-orange uppercase">Your Packs</p>
          <div className="flex flex-col gap-3">
            {activeCredits.map((credit) => (
              <div key={credit.id} className="rounded-2xl border border-gray-mid bg-white p-5">
                <p className="font-heading text-[15px] font-bold text-near-black">
                  {CREDIT_TYPE_LABEL[credit.creditType] ?? credit.creditType}
                </p>
                <p className="font-body text-[13px] text-gray-dark">
                  {credit.athlete.firstName} &middot; {credit.balance} session{credit.balance === 1 ? "" : "s"} left
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Athletes */}
      <AthleteRow athletes={athleteCards} />
      {athletes.length > 0 && (
        <Link href="/my-courts/athletes/new" className="-mt-4 self-start font-sport text-xs font-bold tracking-wide text-orange uppercase">
          + Add Athlete
        </Link>
      )}

      {/* 4. Guardians */}
      <section>
        <p className="mb-2.5 font-sport text-[14px] font-bold tracking-wide text-orange uppercase">Guardians</p>
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
          <Link href="/my-courts/family" className="mt-2 inline-block font-sport text-xs font-bold tracking-wide text-orange uppercase">
            Manage Guardians &rarr;
          </Link>
        )}
      </section>

      {/* Messages — hidden for now, not deleted. See also: my-courts/nav-link.tsx
          ("messages" icon case, unused), lib/os/nav.ts (Communications nav entry,
          hidden), coach app "Message This Team/Group/Family" buttons (hidden).
          Underlying routes, schema, and lib/messaging.ts are untouched. */}

      <WhatsHappening items={happeningItems} />
    </div>
  );
}
