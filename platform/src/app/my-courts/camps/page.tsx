import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { gradeRangeLabel } from "@/lib/programs/types";
import { effectiveEntitlements } from "@/lib/entitlements";
import { startCampRegistration, cancelCampRegistration } from "./actions";
import { CampFilterBar } from "./filter-bar";
import { AchCallout } from "../ach-callout";

export const dynamic = "force-dynamic";

// Whole-camp registration (Fall Break, Thanksgiving, Winter Break — anything
// with registrationMode "offering" or "multi_day"). Single-day camps
// (Early Release, Day Off Game On) are registrationMode "session" and are
// booked through Explore instead, same as any other single session.

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d);
}

function formatWeekday(d: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(d);
}

function formatMonth(d: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(d);
}

export default async function CampsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const guardian = await getCurrentGuardian();
  const sp = await searchParams;
  const athletes = guardian.families.flatMap((fg) => fg.family.athletes);
  const athleteIds = athletes.map((a) => a.id);

  const camps = await prisma.offering.findMany({
    where: {
      status: "published",
      internalOnly: false,
      visibleParentApp: true,
      registrationMode: { in: ["offering", "multi_day"] },
    },
    include: {
      sessions: { orderBy: { startTime: "asc" } },
      registrations: { where: { athleteId: { in: athleteIds } } },
    },
    orderBy: { sessions: { _count: "asc" } },
  });
  // Sort by first session date — Prisma can't order by a nested aggregate
  // field here, so it's done in memory on the small result set instead.
  camps.sort((a, b) => (a.sessions[0]?.startTime.getTime() ?? 0) - (b.sessions[0]?.startTime.getTime() ?? 0));

  // Same member_pricing/class_credit entitlement check the checkout action
  // charges against (see hasMemberPricing in ./actions) — computed once per
  // athlete here so the price shown matches what they'd actually pay,
  // instead of always showing the flat non-member rate.
  const memberships = await prisma.athleteMembership.findMany({
    where: { athleteId: { in: athleteIds }, status: "active" },
    include: { plan: { include: { entitlements: true, entitlementsFromPlan: { include: { entitlements: true } } } } },
  });
  function isMemberFor(athleteId: string, programId: string) {
    return memberships.some(
      (m) =>
        m.athleteId === athleteId &&
        effectiveEntitlements(m.plan).some(
          (e) => (e.benefitType === "member_pricing" || e.benefitType === "class_credit") && (e.programId === null || e.programId === programId)
        )
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-black text-black sm:text-4xl">Camps</h1>
        <p className="mt-1 font-body text-sm text-gray-dark">
          Fall break, holiday break, and no-school-day camps. Weekly drop-in classes and League are elsewhere —
          this is just the multi-day and whole-week programs.
        </p>
      </div>

      {sp.checkout === "success" && (
        <div className="rounded-xl border border-green-600/30 bg-green-50 px-4 py-3 text-sm text-green-800">
          Registered! We&rsquo;ll see you there.
        </div>
      )}
      {sp.checkout === "error" && (
        <div className="rounded-xl border border-danger/30 bg-danger-bg px-4 py-3 text-sm text-danger">
          Something went wrong starting checkout. Try again, or contact us if it keeps happening.
        </div>
      )}

      <AchCallout />

      {athletes.length === 0 ? (
        <div className="rounded-xl border border-gray-mid bg-white p-6 text-center">
          <p className="font-body text-sm text-gray-dark">Add an athlete to your family before registering for a camp.</p>
        </div>
      ) : (
        (() => {
          const months = [
            ...new Set(camps.map((c) => (c.sessions[0] ? formatMonth(c.sessions[0].startTime) : null)).filter((m): m is string => Boolean(m))),
          ];
          const items = camps.map((camp) => {
          const first = camp.sessions[0];
          const last = camp.sessions[camp.sessions.length - 1];
          const dateLabel =
            first && last && first.id !== last.id
              ? `${formatWeekday(first.startTime)}–${formatWeekday(last.startTime)}, ${formatDate(first.startTime)}–${formatDate(last.startTime)}`
              : first
                ? `${formatWeekday(first.startTime)}, ${formatDate(first.startTime)}`
                : "Dates TBD";
          const gradeLabel = gradeRangeLabel(camp.gradeMin, camp.gradeMax);
          const sport = /volleyball/i.test(camp.name) ? "volleyball" : /basketball/i.test(camp.name) ? "basketball" : "other";
          const month = first ? formatMonth(first.startTime) : "other";

          const node = (
            <div className="overflow-hidden rounded-xl border border-gray-mid bg-white">
              <div className="border-b border-gray-mid bg-warm-stone px-4 py-3">
                <p className="font-sport text-sm font-bold uppercase tracking-wide text-orange">{dateLabel}</p>
                <h2 className="font-display text-lg font-black text-black">{camp.name}</h2>
                <p className="mt-0.5 font-body text-sm text-gray-dark">
                  {formatCents(camp.priceCents ?? 0)}
                  {camp.memberPriceCents != null ? ` · Members ${formatCents(camp.memberPriceCents)}` : ""}
                  {camp.registrationMode === "multi_day" && camp.allowSingleDay && camp.singleDayPriceCents
                    ? ` full week · ${formatCents(camp.singleDayPriceCents)}/day`
                    : ""}
                  {gradeLabel ? ` · ${gradeLabel}` : ""}
                </p>
              </div>

              <ul className="divide-y divide-gray-mid">
                {athletes.map((athlete) => {
                  const reg = camp.registrations.find((r) => r.athleteId === athlete.id);
                  const paid = reg?.paymentStatus === "paid";
                  const pending = reg && reg.status !== "cancelled" && !paid;
                  const isMember = isMemberFor(athlete.id, camp.programId);
                  const fullWeekPrice = isMember && camp.memberPriceCents != null ? camp.memberPriceCents : camp.priceCents ?? 0;

                  return (
                    <li key={athlete.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                      <span className="font-body text-sm font-medium text-near-black">
                        {athlete.firstName}
                        {isMember && <span className="ml-2 text-xs font-bold uppercase tracking-wide text-orange">Member</span>}
                      </span>

                      {paid ? (
                        <span className="rounded-full bg-green-50 px-3 py-1 font-sport text-xs font-bold uppercase tracking-wide text-green-800">
                          Registered — {reg?.selection === "single_day" ? "1 Day" : "Full Camp"}
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {pending && (
                            <form action={cancelCampRegistration}>
                              <input type="hidden" name="athleteId" value={athlete.id} />
                              <input type="hidden" name="offeringId" value={camp.id} />
                              <button className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark hover:text-danger">
                                Cancel
                              </button>
                            </form>
                          )}
                          <form action={startCampRegistration} className="flex items-center gap-2">
                            <input type="hidden" name="athleteId" value={athlete.id} />
                            <input type="hidden" name="offeringId" value={camp.id} />
                            {camp.registrationMode === "multi_day" && camp.allowSingleDay ? (
                              <select
                                name="dayChoice"
                                defaultValue="full"
                                className="min-h-9 rounded-lg border border-gray-mid bg-white px-2 text-xs"
                              >
                                <option value="full">Full — {formatCents(fullWeekPrice)}</option>
                                {camp.sessions.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {formatWeekday(s.startTime)}, {formatDate(s.startTime)} — {formatCents(camp.singleDayPriceCents ?? camp.priceCents ?? 0)}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                            <button className="rounded-full bg-orange px-4 py-2 font-heading text-xs font-bold uppercase tracking-wide text-white hover:bg-orange-hover">
                              Register{camp.registrationMode === "offering" ? ` — ${formatCents(fullWeekPrice)}` : ""}
                            </button>
                          </form>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              <p className="border-t border-gray-mid px-4 py-2.5 font-body text-[12.5px] text-gray-dark">
                No refunds after registration.
              </p>
            </div>
          );

          return { id: camp.id, sport, month, node } as const;
          });

          return <CampFilterBar items={items} months={months} />;
        })()
      )}

      {camps.length === 0 && athletes.length > 0 && (
        <div className="rounded-xl border border-gray-mid bg-white p-6 text-center">
          <p className="font-body text-sm text-gray-dark">No camps open for registration right now.</p>
        </div>
      )}
    </div>
  );
}
