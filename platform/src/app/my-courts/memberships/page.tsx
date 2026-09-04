import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { startMembershipCheckout } from "./actions";

function formatPrice(cents: number, interval: string) {
  return `$${(cents / 100).toFixed(2)}/${interval === "monthly" ? "mo" : "yr"}`;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  cancelled: "Cancelled",
  past_due: "Payment failed — update billing",
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
    <div>
      <h1 className="mb-2 text-xl font-bold">Membership</h1>

      {checkout === "success" && (
        <p className="mb-6 rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
          You&rsquo;re all set — your membership is active.
        </p>
      )}
      {checkout === "cancelled" && (
        <p className="mb-6 rounded-md bg-neutral-100 px-4 py-3 text-sm text-neutral-600">
          Checkout was cancelled — no charge was made.
        </p>
      )}

      {athletes.length === 0 ? (
        <p className="text-sm text-neutral-500">No athletes on file yet.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {athletes.map((athlete) => {
            const membership = membershipByAthlete.get(athlete.id);
            return (
              <section key={athlete.id} className="rounded-lg border border-neutral-200 p-5">
                <h2 className="mb-3 text-lg font-semibold">
                  {athlete.firstName} {athlete.lastName}
                </h2>

                {membership ? (
                  <div className="text-sm">
                    <p className="font-medium">{membership.plan.name}</p>
                    <p className="text-neutral-500">
                      {STATUS_LABEL[membership.status] ?? membership.status}
                      {membership.renewalDate &&
                        ` · Renews ${membership.renewalDate.toLocaleDateString()}`}
                    </p>
                  </div>
                ) : plans.length === 0 ? (
                  <p className="text-sm text-neutral-500">No plans available for checkout yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {plans.map((plan) => (
                      <form
                        key={plan.id}
                        action={startMembershipCheckout.bind(null, athlete.id, plan.id)}
                        className="flex items-center justify-between rounded-md border border-neutral-200 px-4 py-3"
                      >
                        <div>
                          <p className="font-medium">{plan.name}</p>
                          <p className="text-sm text-neutral-500">
                            {formatPrice(plan.priceCents, plan.billingInterval)}
                          </p>
                        </div>
                        <button
                          type="submit"
                          className="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white"
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
