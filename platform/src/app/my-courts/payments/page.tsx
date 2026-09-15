import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { payBooking } from "../actions";
import { startBillingPortalSession } from "../memberships/actions";
import { startLeagueRegistration } from "../league/actions";

const LEAGUE_OFFERING_NAME = "Fall 2026 Basketball League";
const LEAGUE_DISPLAY_NAME = "Fall League 2026";
const EVAL_CREDIT_CENTS = 2500; // Matches the real EVAL25 Stripe coupon (amount_off: 2500).

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(date);
}

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

// Payments — what's owed and what's already been paid. Nothing here is a
// second copy of Membership (that has its own sidebar page) — active plans
// get one line, not a card.

export default async function PaymentsPage() {
  const guardian = await getCurrentGuardian();
  const athletes = guardian.families.flatMap((fg) => fg.family.athletes);
  const athleteIds = athletes.map((a) => a.id);

  const [allMemberships, duePendingRegistrations, dueBookings, paidRegistrations, paidBookings] = await Promise.all([
    prisma.athleteMembership.findMany({
      where: { athleteId: { in: athleteIds } },
      include: { plan: true, athlete: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.registration.findMany({
      where: { athleteId: { in: athleteIds }, status: { not: "cancelled" }, paymentStatus: { in: ["pending", "failed"] } },
      include: { offering: true, athlete: true },
      orderBy: { registeredAt: "desc" },
    }),
    prisma.booking.findMany({
      where: { athleteId: { in: athleteIds }, status: { not: "cancelled" }, paymentStatus: "pending" },
      include: { session: { include: { program: true } }, athlete: true },
      orderBy: { bookedAt: "desc" },
    }),
    prisma.registration.findMany({
      where: { athleteId: { in: athleteIds }, paymentStatus: "paid" },
      include: { offering: true, athlete: true },
      orderBy: { registeredAt: "desc" },
    }),
    prisma.booking.findMany({
      where: { athleteId: { in: athleteIds }, paymentStatus: "paid" },
      include: { session: { include: { program: true } }, athlete: true },
      orderBy: { bookedAt: "desc" },
    }),
  ]);

  // Most recent membership row per athlete — an athlete can have more than
  // one over time (e.g. cancelled once, resubscribed), and only the latest
  // is the family's current state.
  const currentMembershipByAthlete = new Map<string, (typeof allMemberships)[number]>();
  for (const m of allMemberships) {
    if (!currentMembershipByAthlete.has(m.athleteId)) currentMembershipByAthlete.set(m.athleteId, m);
  }
  const activeMemberships = [...currentMembershipByAthlete.values()].filter(
    (m) => m.status === "active" || m.status === "past_due"
  );
  const pastDueMemberships = activeMemberships.filter((m) => m.status === "past_due");

  type HistoryItem = {
    id: string;
    date: Date;
    name: string;
    athleteName: string;
    amountCents: number;
    creditAppliedCents: number | null;
    receiptUrl: string | null;
  };
  const history: HistoryItem[] = [
    ...paidRegistrations
      .filter((r) => r.amountCents != null)
      .map((r) => ({
        id: `reg-${r.id}`,
        date: r.updatedAt,
        name: r.offering.name === LEAGUE_OFFERING_NAME ? LEAGUE_DISPLAY_NAME : r.offering.name,
        athleteName: `${r.athlete.firstName} ${r.athlete.lastName}`,
        amountCents: r.amountCents!,
        creditAppliedCents: r.creditAppliedCents,
        receiptUrl: r.receiptUrl,
      })),
    ...paidBookings
      .filter((b) => b.priceChargedCents != null)
      .map((b) => ({
        id: `booking-${b.id}`,
        date: b.bookedAt,
        name: b.session.program.name,
        athleteName: `${b.athlete.firstName} ${b.athlete.lastName}`,
        amountCents: b.priceChargedCents!,
        creditAppliedCents: null,
        receiptUrl: b.receiptUrl,
      })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const hasAnythingDue = duePendingRegistrations.length > 0 || dueBookings.length > 0 || pastDueMemberships.length > 0;
  const allCaughtUp = !hasAnythingDue && history.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-2xl font-black text-black">Payments</h1>

      {/* Active membership(s) — one line each, not a card. No plan at all
          means no line; Membership has its own page for that. */}
      {activeMemberships.length > 0 && (
        <div className="flex flex-col gap-1">
          {activeMemberships.map((m) => (
            <p key={m.id} className="font-body text-sm text-gray-dark">
              <span className="font-bold text-black">{m.athlete.firstName}:</span> {m.plan.name} &middot;{" "}
              {formatPrice(m.plan.priceCents)}/mo &middot;{" "}
              {m.status === "past_due"
                ? "payment didn't go through"
                : m.cancelAt
                  ? `cancels ${formatDate(m.cancelAt)}`
                  : m.renewalDate
                    ? `next charge ${formatDate(m.renewalDate)}`
                    : null}
            </p>
          ))}
        </div>
      )}

      {allCaughtUp ? (
        <p className="rounded-lg border border-gray-mid bg-white px-4 py-6 text-center font-body text-sm text-gray-dark">
          You&rsquo;re all caught up.
        </p>
      ) : (
        <>
          {/* Payments Due */}
          {hasAnythingDue && (
            <section>
              <p className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-orange">Payments Due</p>
              <div className="flex flex-col gap-2">
                {pastDueMemberships.map((m) => (
                  <div key={`mem-${m.id}`} className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="font-heading font-bold text-black">{m.plan.name}</p>
                    <p className="font-body text-xs text-gray-dark">{m.athlete.firstName} {m.athlete.lastName}</p>
                    <p className="mt-1 font-body text-sm text-gray-dark">Your last payment didn&rsquo;t go through.</p>
                    <form action={startBillingPortalSession} className="mt-3">
                      <button
                        type="submit"
                        className="rounded-full bg-black px-4 py-2 font-sport text-[11px] font-bold uppercase tracking-wide text-white hover:bg-orange"
                      >
                        Update Payment Method &rarr;
                      </button>
                    </form>
                  </div>
                ))}

                {duePendingRegistrations.map((r) => {
                  const isLeague = r.offering.name === LEAGUE_OFFERING_NAME;
                  const displayName = isLeague ? LEAGUE_DISPLAY_NAME : r.offering.name;
                  const base = r.offering.priceCents ?? 0;
                  // The evaluation credit is a real, blanket League credit
                  // (leagues.html has always advertised it that way) —
                  // shown here, and applied automatically at checkout, so
                  // this number is always what Stripe will actually charge.
                  const credit = isLeague ? EVAL_CREDIT_CENTS : 0;
                  const total = base - credit;
                  const dueDate = isLeague && r.offering.registrationClosesAt ? r.offering.registrationClosesAt : null;

                  return (
                    <div key={`reg-${r.id}`} className="rounded-lg border border-orange/40 bg-orange/5 p-4">
                      <p className="font-heading font-bold text-black">
                        {displayName} <span className="font-normal text-gray-dark">&middot; {r.athlete.firstName}</span>
                      </p>
                      {dueDate && <p className="font-body text-xs text-gray-dark">Due {formatDate(dueDate)}</p>}
                      {r.paymentStatus === "failed" && (
                        <p className="mt-1 font-body text-xs text-red-700">Your last payment attempt failed.</p>
                      )}
                      <div className="mt-3 flex flex-col gap-1 font-body text-sm text-gray-dark">
                        <div className="flex items-center justify-between">
                          <span>League registration</span>
                          <span>{formatPrice(base)}</span>
                        </div>
                        {credit > 0 && (
                          <div className="flex items-center justify-between">
                            <span>Evaluation credit (EVAL25)</span>
                            <span>&minus;{formatPrice(credit)}</span>
                          </div>
                        )}
                        <div className="mt-1 flex items-center justify-between border-t border-gray-mid pt-1.5 font-bold text-black">
                          <span>Total</span>
                          <span>{formatPrice(total)}</span>
                        </div>
                      </div>
                      <form action={startLeagueRegistration.bind(null, r.athleteId)} className="mt-3">
                        <button
                          type="submit"
                          className="rounded-full bg-orange px-4 py-2 font-sport text-[11px] font-bold uppercase tracking-wide text-white"
                        >
                          Pay {formatPrice(total)} &rarr;
                        </button>
                      </form>
                    </div>
                  );
                })}

                {dueBookings.map((b) => (
                  <div key={`booking-${b.id}`} className="rounded-lg border border-orange/40 bg-orange/5 p-4">
                    <p className="font-heading font-bold text-black">
                      {b.session.program.name} <span className="font-normal text-gray-dark">&middot; {b.athlete.firstName}</span>
                    </p>
                    <form action={payBooking.bind(null, b.id)} className="mt-3">
                      <button
                        type="submit"
                        className="rounded-full bg-orange px-4 py-2 font-sport text-[11px] font-bold uppercase tracking-wide text-white"
                      >
                        Pay {formatPrice(b.priceChargedCents ?? 0)} &rarr;
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Payment History */}
          <section>
            <p className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-orange">Payment History</p>
            {history.length === 0 ? (
              <p className="font-body text-sm text-gray-dark">No payments yet.</p>
            ) : (
              <div className="flex flex-col divide-y divide-gray-mid rounded-lg border border-gray-mid bg-white">
                {history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-body text-xs text-gray-dark">{formatDate(item.date)}</p>
                      <p className="font-heading text-sm font-bold text-black">{item.name}</p>
                      <p className="font-body text-xs text-gray-dark">{item.athleteName}</p>
                      {item.creditAppliedCents != null && item.creditAppliedCents > 0 && (
                        <p className="mt-0.5 font-body text-xs text-gray-dark">
                          {formatPrice(item.amountCents + item.creditAppliedCents)} total &middot; &minus;
                          {formatPrice(item.creditAppliedCents)} credit applied
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="font-body text-sm text-black">{formatPrice(item.amountCents)}</span>
                      {item.receiptUrl && (
                        <a
                          href={item.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-sport text-[10.5px] font-bold tracking-wide text-orange uppercase"
                        >
                          View Receipt &rarr;
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
