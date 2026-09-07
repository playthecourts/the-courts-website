import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { startMembershipCheckout } from "./actions";

function formatPrice(cents: number, interval: string) {
  return `$${(cents / 100).toFixed(2)}/${interval === "monthly" ? "mo" : "yr"}`;
}

const STATUS_LABEL: Record<string, string> = {
  active: "You're In",
  paused: "Paused",
  cancelled: "Cancelled",
  past_due: "Payment didn't go through — update billing",
};

export default async function MembershipsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const guardian = await getCurrentGuardian();
  const athletes = guardian.families.flatMap((fg) => fg.family.athletes);

  const [memberships, plans] = await Promise.all([
    prisma.athleteMembership.findMany({
      where: { athleteId: { in: athletes.map((a) => a.id) } },
      include: { plan: true },
    }),
    prisma.membershipPlan.findMany({
      where: { active: true, stripePriceId: { not: null } },
      orderBy: { priceCents: "asc" },
    }),
  ]);

  const membershipByAthlete = new Map(memberships.map((m) => [m.athleteId, m]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-black text-black">Your Training Plan</h1>

      {checkout === "success" && (
        <p className="rounded-lg border border-orange bg-white px-4 py-3 font-body text-sm text-black">
          You&rsquo;re in — your Training Plan is active.
        </p>
      )}
      {checkout === "cancelled" && (
        <p className="rounded-lg border border-gray-mid bg-white px-4 py-3 font-body text-sm text-gray-dark">
          Checkout was cancelled — no charge was made.
        </p>
      )}

      {athletes.length === 0 ? (
        <p className="font-body text-sm text-gray-dark">No athletes on file yet.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {athletes.map((athlete) => {
            const membership = membershipByAthlete.get(athlete.id);
            return (
              <section key={athlete.id} className="rounded-lg border border-gray-mid bg-white p-5">
                <h2 className="mb-3 font-heading font-bold text-black">
                  {athlete.firstName} {athlete.lastName}
                </h2>

                {membership ? (
                  <div>
                    <p className="font-heading font-bold text-black">{membership.plan.name}</p>
                    <p className="font-body text-sm text-gray-dark">
                      {STATUS_LABEL[membership.status] ?? membership.status}
                      {membership.renewalDate &&
                        ` · Renews ${membership.renewalDate.toLocaleDateString()}`}
                    </p>
                  </div>
                ) : plans.length === 0 ? (
                  <p className="font-body text-sm text-gray-dark">No plans available for checkout yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {plans.map((plan) => (
                      <form
                        key={plan.id}
                        action={startMembershipCheckout.bind(null, athlete.id, plan.id)}
                        className="flex items-center justify-between rounded-md border border-gray-mid px-4 py-3"
                      >
                        <div>
                          <p className="font-heading font-bold text-black">{plan.name}</p>
                          <p className="font-body text-sm text-gray-dark">
                            {formatPrice(plan.priceCents, plan.billingInterval)}
                          </p>
                        </div>
                        <button
                          type="submit"
                          className="min-h-[36px] rounded-full bg-black px-4 font-sport text-xs font-bold uppercase tracking-wide text-white hover:bg-orange"
                        >
                          Subscribe
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
