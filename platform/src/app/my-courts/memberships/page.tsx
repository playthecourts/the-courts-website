import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  changeMembershipTier,
  reverseScheduledCancellation,
  startBillingPortalSession,
  startMembershipCheckout,
} from "./actions";
import { CancelMembershipFlow } from "./cancel-flow";

function formatPrice(cents: number, interval: string) {
  return `$${(cents / 100).toFixed(2)}/${interval === "monthly" ? "mo" : "yr"}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  active: "You're In",
  paused: "Paused",
  cancelled: "Cancelled",
  past_due: "Payment didn't go through — update billing",
};

function SubscribeOptions({
  athleteId,
  plans,
}: {
  athleteId: string;
  plans: { id: string; name: string; priceCents: number; billingInterval: string }[];
}) {
  if (plans.length === 0) {
    return <p className="font-body text-sm text-gray-dark">No plans available for checkout yet.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {plans.map((plan) => (
        <form
          key={plan.id}
          action={startMembershipCheckout.bind(null, athleteId, plan.id)}
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
  );
}

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
      orderBy: { createdAt: "desc" },
    }),
    prisma.membershipPlan.findMany({
      where: { active: true, stripePriceId: { not: null } },
      orderBy: { priceCents: "asc" },
    }),
  ]);

  // Most recent row per athlete wins — an athlete can accumulate more than
  // one AthleteMembership over time (cancelled, then later resubscribed),
  // and only the latest one should drive what the page shows.
  const membershipByAthlete = new Map<string, (typeof memberships)[number]>();
  for (const m of memberships) {
    if (!membershipByAthlete.has(m.athleteId)) membershipByAthlete.set(m.athleteId, m);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-black text-black">Your Training Plan</h1>
        {guardian.stripeCustomerId && (
          <form action={startBillingPortalSession}>
            <button
              type="submit"
              className="min-h-[36px] rounded-full border border-gray-mid px-4 font-sport text-xs font-bold uppercase tracking-wide text-black hover:border-orange hover:text-orange"
            >
              Manage Billing →
            </button>
          </form>
        )}
      </div>

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
            const otherPlans = plans.filter((p) => p.id !== membership?.membershipPlanId);

            return (
              <section key={athlete.id} className="rounded-lg border border-gray-mid bg-white p-5">
                <h2 className="mb-3 font-heading font-bold text-black">
                  {athlete.firstName} {athlete.lastName}
                </h2>

                {!membership && <SubscribeOptions athleteId={athlete.id} plans={plans} />}

                {membership && membership.cancelAtPeriodEnd && (
                  <div>
                    <p className="font-heading font-bold text-black">{membership.plan.name}</p>
                    <p className="font-body text-sm text-gray-dark">
                      Cancels{membership.renewalDate ? ` ${formatDate(membership.renewalDate)}` : ""}
                    </p>
                    <form
                      action={reverseScheduledCancellation.bind(null, membership.id)}
                      className="mt-3"
                    >
                      <button
                        type="submit"
                        className="rounded-full bg-orange px-4 py-2 font-sport text-xs font-bold uppercase tracking-wide text-white hover:bg-orange-hover"
                      >
                        Keep My Membership
                      </button>
                    </form>
                  </div>
                )}

                {membership && !membership.cancelAtPeriodEnd && membership.status === "cancelled" && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="font-heading font-bold text-black">{membership.plan.name}</p>
                      <p className="font-body text-sm text-gray-dark">{STATUS_LABEL.cancelled}</p>
                    </div>
                    <SubscribeOptions athleteId={athlete.id} plans={plans} />
                  </div>
                )}

                {membership &&
                  !membership.cancelAtPeriodEnd &&
                  membership.status !== "cancelled" && (
                    <div className="flex flex-col gap-4">
                      <div>
                        <p className="font-heading font-bold text-black">{membership.plan.name}</p>
                        <p className="font-body text-sm text-gray-dark">
                          {STATUS_LABEL[membership.status] ?? membership.status}
                          {membership.renewalDate &&
                            ` · Renews ${formatDate(membership.renewalDate)}`}
                        </p>
                      </div>

                      {/* Manually-assigned memberships (no stripeSubscriptionId) aren't
                          self-service — there's no subscription to switch or cancel from
                          this side, so those controls only appear for online-billed ones. */}
                      {membership.stripeSubscriptionId ? (
                        <>
                          {otherPlans.length > 0 && (
                            <div>
                              <p className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">
                                Switch Plan
                              </p>
                              <div className="flex flex-col gap-2">
                                {otherPlans.map((plan) => (
                                  <form
                                    key={plan.id}
                                    action={changeMembershipTier.bind(null, membership.id, plan.id)}
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
                                      className="min-h-[36px] rounded-full border border-gray-mid px-4 font-sport text-xs font-bold uppercase tracking-wide text-black hover:border-orange hover:text-orange"
                                    >
                                      Switch
                                    </button>
                                  </form>
                                ))}
                              </div>
                            </div>
                          )}

                          <CancelMembershipFlow
                            athleteMembershipId={membership.id}
                            planName={membership.plan.name}
                            effectiveDateLabel={
                              membership.renewalDate
                                ? formatDate(membership.renewalDate)
                                : "the end of your current period"
                            }
                          />
                        </>
                      ) : (
                        <p className="font-body text-[13px] text-gray-dark">
                          Set up by The Courts — contact us to make changes.
                        </p>
                      )}
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
