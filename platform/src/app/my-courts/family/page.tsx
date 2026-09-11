import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { familyCrewInitials, familyCrewName } from "@/lib/family";
import { getWeeklySessionBalances } from "@/lib/entitlements";
import { displayName } from "@/lib/athlete";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(date);
}

// Next Sunday at 00:00 UTC — when class_credit balances actually reset.
// Deliberately NOT the membership's billing renewalDate: those are two
// different clocks (see lib/entitlements.ts), and showing the wrong one
// would tell a parent their sessions refill on a date they don't.
function nextWeeklyReset(now: Date) {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + (7 - d.getUTCDay()));
  return d;
}

const ACCOUNT_LINKS = [
  { href: "/my-courts/payments", label: "Payment Method" },
  { href: "/my-courts/payments", label: "Billing History" },
  { href: "/my-courts/waivers", label: "Waivers + Releases" },
  { href: "/my-courts/messages", label: "Messages" },
  { href: "/my-courts/settings", label: "Family Settings" },
];

export default async function FamilyProfilePage() {
  const guardian = await getCurrentGuardian();
  const family = guardian.families[0]?.family ?? null;
  const crewName = familyCrewName(family?.name);
  const initials = familyCrewInitials(family?.name);
  const athletes = family?.athletes ?? [];
  const now = new Date();
  const resetDate = formatDate(nextWeeklyReset(now));

  // A guardian can belong to more than one family in the schema, but the
  // Parent App only ever shows the first — same assumption the rest of
  // my-courts already makes (see layout.tsx, page.tsx).
  const guardians = guardian.families[0]
    ? [{ id: guardian.id, name: guardian.name, email: guardian.email }]
    : [];

  const athleteMemberships = athletes.length
    ? await prisma.athleteMembership.findMany({
        where: { athleteId: { in: athletes.map((a) => a.id) }, status: "active" },
        include: { plan: { include: { entitlements: true } }, athlete: { select: { firstName: true } } },
      })
    : [];

  const credits = athletes.length
    ? await prisma.credit.findMany({
        where: {
          athleteId: { in: athletes.map((a) => a.id) },
          status: "issued",
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
      })
    : [];

  const membershipRows = await Promise.all(
    athleteMemberships.map(async (m) => {
      const balances = await getWeeklySessionBalances(m.athleteId);
      const memberPricing = m.plan.entitlements.filter((e) => e.benefitType === "member_pricing");
      const athleteCredits = credits.filter((c) => c.athleteId === m.athleteId);
      return { membership: m, balances, memberPricing, athleteCredits };
    })
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-near-black font-display text-lg font-black text-white">
          {initials}
        </span>
        <div>
          <h1 className="font-display text-xl font-black text-black">{crewName}</h1>
          <p className="font-body text-sm text-gray-dark">Family Account</p>
        </div>
      </div>

      <section>
        <p className="mb-2 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
          Guardians
        </p>
        <div className="flex flex-col divide-y divide-gray-mid rounded-2xl border border-gray-mid bg-white">
          {guardians.map((g) => (
            <div key={g.id} className="flex items-center justify-between px-4 py-3.5">
              <p className="font-heading text-sm font-bold text-near-black">{g.name}</p>
              <p className="font-body text-sm text-gray-dark">{g.email}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-2 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
          Membership
        </p>
        {membershipRows.length > 0 ? (
          <div className="flex flex-col gap-3">
            {membershipRows.map(({ membership, balances, memberPricing, athleteCredits }) => (
              <div key={membership.id} className="rounded-2xl border border-gray-mid bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading text-[15px] font-bold text-near-black">
                      {membership.plan.name}
                    </p>
                    <p className="font-body text-[12.5px] text-gray-dark">
                      {membership.athlete.firstName}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-orange/10 px-2.5 py-1 font-sport text-[10.5px] font-bold tracking-wide text-orange uppercase">
                    Active
                  </span>
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-gray-mid pt-4">
                  {balances.map((b, i) => (
                    <div key={i}>
                      <p className="font-heading text-[13.5px] font-bold text-near-black">
                        {b.membershipPlanName}
                      </p>
                      <p className="font-body text-[13px] text-gray-dark">
                        {b.quantityPerPeriod - b.usedThisWeek} of {b.quantityPerPeriod} sessions
                        remaining
                      </p>
                      <p className="font-body text-[12px] text-gray-dark/70">Resets {resetDate}</p>
                    </div>
                  ))}
                  {athleteCredits.map((c) => (
                    <div key={c.id}>
                      <p className="font-heading text-[13.5px] font-bold text-near-black">
                        {c.source ?? c.creditType}
                      </p>
                      <p className="font-body text-[13px] text-gray-dark">
                        {c.balance} session{c.balance === 1 ? "" : "s"} remaining
                      </p>
                    </div>
                  ))}
                  {memberPricing.map((e) => (
                    <p key={e.id} className="font-body text-[13px] text-gray-dark">
                      Member rate available
                      {e.programId ? "" : " on all programs"}
                    </p>
                  ))}
                  {membership.renewalDate && (
                    <p className="font-body text-[12px] text-gray-dark/70">
                      Renews {formatDate(membership.renewalDate)}
                    </p>
                  )}
                </div>

                <Link
                  href="/my-courts/memberships"
                  className="mt-4 inline-block font-sport text-[11px] font-bold tracking-wide text-orange uppercase"
                >
                  Manage Membership &rarr;
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-mid bg-white px-5 py-5">
            <p className="font-heading text-[15px] font-bold text-near-black">No Active Membership</p>
            <p className="mt-1 font-body text-sm text-gray-dark">
              Choose a membership to start October 1.
            </p>
            <Link
              href="/my-courts/memberships"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-orange px-5 py-2.5 font-sport text-[11px] font-bold tracking-wide text-white uppercase"
            >
              View Memberships &rarr;
            </Link>
          </div>
        )}
      </section>

      <section>
        <p className="mb-2 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
          Athletes
        </p>
        {athletes.length > 0 ? (
          <div className="flex flex-col divide-y divide-gray-mid rounded-2xl border border-gray-mid bg-white">
            {athletes.map((a) => (
              <Link
                key={a.id}
                href={`/my-courts/athletes/${a.id}`}
                className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-gray-light"
              >
                <div>
                  <p className="font-heading text-sm font-bold text-near-black">{displayName(a)}</p>
                  {a.grade && <p className="font-body text-[12.5px] text-gray-dark">Grade {a.grade}</p>}
                </div>
                <span className="font-sport text-[11px] font-bold tracking-wide text-orange uppercase">
                  View Profile &rarr;
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-gray-mid bg-white px-4 py-3.5 font-body text-sm text-gray-dark">
            No athletes on this account yet.
          </p>
        )}
      </section>

      <section>
        <p className="mb-2 font-sport text-[13px] font-bold tracking-wide text-orange uppercase">
          Account
        </p>
        <div className="flex flex-col divide-y divide-gray-mid rounded-2xl border border-gray-mid bg-white">
          {ACCOUNT_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="flex items-center justify-between px-4 py-3.5 transition-colors hover:bg-gray-light"
            >
              <span className="font-heading text-sm font-bold text-near-black">{link.label}</span>
              <span className="text-gray-dark">&rarr;</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
