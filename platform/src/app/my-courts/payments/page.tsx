import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(date);
}

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function PaymentsPage() {
  const guardian = await getCurrentGuardian();
  const athletes = guardian.families.flatMap((fg) => fg.family.athletes);
  const athleteIds = athletes.map((a) => a.id);

  const [paidBookings, memberships, credits] = await Promise.all([
    prisma.booking.findMany({
      where: { athleteId: { in: athleteIds }, priceChargedCents: { not: null } },
      include: { session: { include: { program: true } }, athlete: true },
      orderBy: { bookedAt: "desc" },
    }),
    prisma.athleteMembership.findMany({
      where: { athleteId: { in: athleteIds } },
      include: { plan: true, athlete: true },
    }),
    prisma.credit.findMany({ where: { athleteId: { in: athleteIds } }, include: { athlete: true } }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-2xl font-black text-black">Payments</h1>

      <section>
        <p className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-orange">Training Plans</p>
        {memberships.length === 0 ? (
          <p className="font-body text-sm text-gray-dark">No Training Plans on file.</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-mid rounded-lg border border-gray-mid bg-white">
            {memberships.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-heading text-sm font-bold text-black">{m.plan.name}</p>
                  <p className="font-body text-xs text-gray-dark">{m.athlete.firstName}</p>
                </div>
                <div className="text-right">
                  <p className="font-body text-sm text-black">{formatPrice(m.plan.priceCents)}/{m.plan.billingInterval === "monthly" ? "mo" : "yr"}</p>
                  <p className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">
                    {m.status === "past_due" ? "Payment Failed" : m.status === "active" ? "Paid" : m.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {credits.length > 0 && (
        <section>
          <p className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-orange">Credits</p>
          <div className="flex flex-col gap-2">
            {credits.map((c) => (
              <div key={c.id} className="rounded-lg border border-orange bg-white p-4">
                <p className="font-heading font-bold text-black">
                  ${(c.balance / 100).toFixed(0)} Credit &mdash; {c.athlete.firstName}
                </p>
                {c.source && <p className="mt-1 font-body text-sm text-gray-dark">{c.source}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <p className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-orange">Receipts</p>
        {paidBookings.length === 0 ? (
          <p className="font-body text-sm text-gray-dark">No payments on file yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-mid rounded-lg border border-gray-mid bg-white">
            {paidBookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-body text-xs text-gray-dark">{formatDate(b.bookedAt)}</p>
                  <p className="font-heading text-sm font-bold text-black">{b.session.program.name}</p>
                  <p className="font-body text-xs text-gray-dark">{b.athlete.firstName}</p>
                </div>
                <p className="font-body text-sm text-black">{formatPrice(b.priceChargedCents!)} &middot; Paid</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
