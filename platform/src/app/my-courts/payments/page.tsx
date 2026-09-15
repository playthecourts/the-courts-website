import type { ReactNode } from "react";
import Link from "next/link";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { payBooking } from "../actions";
import { startBillingPortalSession } from "../memberships/actions";
import { startLeagueRegistration } from "../league/actions";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(date);
}

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function Pill({ tone, children }: { tone: "active" | "due" | "past_due" | "paid"; children: ReactNode }) {
  const toneClasses: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    due: "bg-orange/10 text-orange",
    past_due: "bg-red-100 text-red-700",
    paid: "bg-gray-light text-gray-dark",
  };
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 font-sport text-[10.5px] font-bold tracking-wide uppercase ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

// Payments — the family's actual money picture: what plan they're on, what's
// owed right now, and what's already been paid. Three sections, one status
// per item, never mixing unpaid and paid in the same list.

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

  const pastDueMemberships = [...currentMembershipByAthlete.values()].filter((m) => m.status === "past_due");

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
        name: r.offering.name,
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

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-2xl font-black text-black">Payments</h1>

      {/* Membership Plan */}
      <section>
        <p className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-orange">Membership Plan</p>
        {athletes.length === 0 ? (
          <p className="font-body text-sm text-gray-dark">Add an athlete to get started.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {athletes.map((athlete) => {
              const membership = currentMembershipByAthlete.get(athlete.id);
              const isCurrent = membership && membership.status !== "cancelled";
              if (!isCurrent) {
                return (
                  <div key={athlete.id} className="rounded-lg border border-gray-mid bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-heading font-bold text-black">No Membership Plan</p>
                        <p className="font-body text-xs text-gray-dark">{athlete.firstName} {athlete.lastName}</p>
                      </div>
                      <Pill tone="due">No Active Plan</Pill>
                    </div>
                    <p className="mt-2 font-body text-sm text-gray-dark">
                      Memberships give {athlete.firstName} access to training, member pricing, and other Courts benefits.
                    </p>
                    <Link
                      href="/my-courts/memberships"
                      className="mt-3 inline-block font-sport text-[11px] font-bold tracking-wide text-orange uppercase"
                    >
                      View Membership Plans &rarr;
                    </Link>
                  </div>
                );
              }
              return (
                <div key={athlete.id} className="rounded-lg border border-gray-mid bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-heading font-bold text-black">{membership.plan.name}</p>
                      <p className="font-body text-xs text-gray-dark">{athlete.firstName} {athlete.lastName}</p>
                      <p className="mt-1 font-body text-sm text-black">
                        {formatPrice(membership.plan.priceCents)}/{membership.plan.billingInterval === "monthly" ? "mo" : "yr"}
                      </p>
                    </div>
                    <Pill tone={membership.status === "past_due" ? "past_due" : "active"}>
                      {membership.status === "past_due" ? "Past Due" : "Active"}
                    </Pill>
                  </div>
                  {membership.cancelAt ? (
                    <p className="mt-2 font-body text-sm text-gray-dark">Cancels {formatDate(membership.cancelAt)}</p>
                  ) : membership.renewalDate ? (
                    <p className="mt-2 font-body text-sm text-gray-dark">
                      Next payment: {formatDate(membership.renewalDate)} &middot; {formatPrice(membership.plan.priceCents)}
                    </p>
                  ) : null}
                  <Link
                    href="/my-courts/memberships"
                    className="mt-3 inline-block font-sport text-[11px] font-bold tracking-wide text-orange uppercase"
                  >
                    Manage Membership &rarr;
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Payments Due */}
      {hasAnythingDue && (
        <section>
          <p className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-orange">Payments Due</p>
          <div className="flex flex-col gap-2">
            {pastDueMemberships.map((m) => (
              <div key={`mem-${m.id}`} className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading font-bold text-black">{m.plan.name}</p>
                    <p className="font-body text-xs text-gray-dark">{m.athlete.firstName} {m.athlete.lastName}</p>
                    <p className="mt-1 font-body text-sm text-gray-dark">Your last payment didn&rsquo;t go through.</p>
                  </div>
                  <Pill tone="past_due">Past Due</Pill>
                </div>
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
              const original = r.offering.priceCents ?? 0;
              const creditApplied = r.creditAppliedCents ?? 0;
              const showsCredit = creditApplied > 0 && r.amountCents != null;
              const amountDue = r.amountCents ?? original;
              return (
                <div key={`reg-${r.id}`} className="rounded-lg border border-orange/40 bg-orange/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-heading font-bold text-black">{r.offering.name}</p>
                      <p className="font-body text-xs text-gray-dark">{r.athlete.firstName} {r.athlete.lastName}</p>
                    </div>
                    <Pill tone={r.paymentStatus === "failed" ? "past_due" : "due"}>
                      {r.paymentStatus === "failed" ? "Payment Failed" : "Payment Due"}
                    </Pill>
                  </div>
                  {showsCredit ? (
                    <div className="mt-2 font-body text-sm text-gray-dark">
                      <p>{formatPrice(original)} total</p>
                      <p>&minus;{formatPrice(creditApplied)} credit applied</p>
                      <p className="font-bold text-black">{formatPrice(amountDue)} remaining</p>
                    </div>
                  ) : (
                    <p className="mt-2 font-body text-sm text-gray-dark">{formatPrice(amountDue)} due</p>
                  )}
                  <form action={startLeagueRegistration.bind(null, r.athleteId)} className="mt-3">
                    <button
                      type="submit"
                      className="rounded-full bg-orange px-4 py-2 font-sport text-[11px] font-bold uppercase tracking-wide text-white"
                    >
                      Pay {formatPrice(amountDue)} &rarr;
                    </button>
                  </form>
                </div>
              );
            })}

            {dueBookings.map((b) => (
              <div key={`booking-${b.id}`} className="rounded-lg border border-orange/40 bg-orange/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading font-bold text-black">{b.session.program.name}</p>
                    <p className="font-body text-xs text-gray-dark">{b.athlete.firstName} {b.athlete.lastName}</p>
                  </div>
                  <Pill tone="due">Payment Due</Pill>
                </div>
                <p className="mt-2 font-body text-sm text-gray-dark">{formatPrice(b.priceChargedCents ?? 0)} due</p>
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
          <p className="font-body text-sm text-gray-dark">No payments on file yet.</p>
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
                  <div className="flex items-center gap-2">
                    <span className="font-body text-sm text-black">{formatPrice(item.amountCents)}</span>
                    <Pill tone="paid">Paid</Pill>
                  </div>
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
    </div>
  );
}
