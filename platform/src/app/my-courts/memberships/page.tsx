import type { ReactNode } from "react";
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

type PlanWithEntitlements = {
  id: string;
  name: string;
  priceCents: number;
  billingInterval: string;
  description: string | null;
  entitlements: {
    benefitType: string;
    quantityPerPeriod: number | null;
    program: { name: string } | null;
  }[];
};

// Derives what a plan actually grants from its real PlanEntitlement rows —
// never hand-typed per plan, so this can never drift from what checkout
// (and the pricing engine) actually enforces.
function planBenefits(plan: PlanWithEntitlements): { headline: string | null; alsoIncludes: string[] } {
  const groupTraining = plan.entitlements.find((e) => e.benefitType === "class_credit" && !e.program);
  const headline = !groupTraining
    ? null
    : groupTraining.quantityPerPeriod === null
      ? "Unlimited Group Training"
      : `${groupTraining.quantityPerPeriod} Group Training Session${groupTraining.quantityPerPeriod === 1 ? "" : "s"}`;

  const alsoIncludes: string[] = [];
  for (const e of plan.entitlements) {
    if (e.benefitType === "class_credit" && e.program && e.quantityPerPeriod != null) {
      alsoIncludes.push(`${e.quantityPerPeriod} ${e.program.name} session${e.quantityPerPeriod === 1 ? "" : "s"} each billing cycle`);
    }
  }
  const memberPricePrograms = plan.entitlements
    .filter((e) => e.benefitType === "member_pricing" && e.program)
    .map((e) => e.program!.name);
  if (memberPricePrograms.length > 0) {
    alsoIncludes.push(`Member pricing on ${memberPricePrograms.join(", ")}`);
  }

  return { headline, alsoIncludes };
}

function PlanCard({
  plan,
  cta,
  compact = false,
}: {
  plan: PlanWithEntitlements;
  cta: ReactNode;
  compact?: boolean;
}) {
  const { headline, alsoIncludes } = planBenefits(plan);
  const shortName = plan.name.replace(/\s+Membership$/, "");

  return (
    <div className="rounded-lg border border-gray-mid bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-heading font-bold text-black">{shortName}</p>
          <p className="font-body text-sm text-gray-dark">{formatPrice(plan.priceCents, plan.billingInterval)}</p>
        </div>
      </div>
      {headline && (
        <p className="mt-2 font-heading text-[14px] font-bold text-orange">{headline}</p>
      )}
      {!compact && plan.description && (
        <p className="mt-1 font-body text-[13.5px] leading-snug text-gray-dark">{plan.description}</p>
      )}
      {alsoIncludes.length > 0 && (
        <p className="mt-1 font-body text-[12.5px] leading-snug text-gray-dark">
          Also includes: {alsoIncludes.join(" · ")}
        </p>
      )}
      <div className="mt-3">{cta}</div>
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
      include: { plan: { include: { entitlements: { include: { program: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.membershipPlan.findMany({
      where: { active: true, stripePriceId: { not: null } },
      include: { entitlements: { include: { program: true } } },
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

  // Computed once for the whole render, not per-athlete-row: the actual
  // cancellation date is decided server-side at submit time in
  // cancelMembership — this is only a preview, and every row previewing the
  // same moment is more honest than each one drifting by milliseconds.
  const now = new Date();
  const cancelPreviewDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-black text-black">Membership</h1>
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
            const hasCurrentPlan = membership && membership.status !== "cancelled";
            const otherPlans = plans.filter((p) => p.id !== membership?.membershipPlanId);

            return (
              <section key={athlete.id} className="rounded-lg border border-gray-mid bg-white p-5">
                <h2 className="mb-3 font-heading font-bold text-black">
                  {athlete.firstName} {athlete.lastName}
                </h2>

                {!membership && (
                  <div className="flex flex-col gap-3">
                    <p className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">
                      Available Plans
                    </p>
                    {plans.length === 0 ? (
                      <p className="font-body text-sm text-gray-dark">No plans available for checkout yet.</p>
                    ) : (
                      plans.map((plan) => (
                        <PlanCard
                          key={plan.id}
                          plan={plan}
                          cta={
                            <form action={startMembershipCheckout.bind(null, athlete.id, plan.id)}>
                              <button
                                type="submit"
                                className="min-h-[36px] rounded-full bg-black px-4 font-sport text-xs font-bold uppercase tracking-wide text-white hover:bg-orange"
                              >
                                Select Plan
                              </button>
                            </form>
                          }
                        />
                      ))
                    )}
                  </div>
                )}

                {membership && membership.cancelAt && (
                  <div>
                    <PlanCard
                      plan={membership.plan}
                      cta={
                        <span className="inline-block rounded-full bg-orange/10 px-2.5 py-1 font-sport text-[10.5px] font-bold uppercase tracking-wide text-orange">
                          Cancels {formatDate(membership.cancelAt)}
                        </span>
                      }
                    />
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

                {membership && !membership.cancelAt && membership.status === "cancelled" && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="font-heading font-bold text-black">
                        {membership.plan.name.replace(/\s+Membership$/, "")}
                      </p>
                      <p className="font-body text-sm text-gray-dark">{STATUS_LABEL.cancelled}</p>
                    </div>
                    <p className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">
                      Available Plans
                    </p>
                    {plans.map((plan) => (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        cta={
                          <form action={startMembershipCheckout.bind(null, athlete.id, plan.id)}>
                            <button
                              type="submit"
                              className="min-h-[36px] rounded-full bg-black px-4 font-sport text-xs font-bold uppercase tracking-wide text-white hover:bg-orange"
                            >
                              Select Plan
                            </button>
                          </form>
                        }
                      />
                    ))}
                  </div>
                )}

                {hasCurrentPlan && !membership!.cancelAt && (
                  <div className="flex flex-col gap-4">
                    <PlanCard
                      plan={membership!.plan}
                      cta={
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-block rounded-full bg-green-100 px-2.5 py-1 font-sport text-[10.5px] font-bold uppercase tracking-wide text-green-800">
                            Current Plan
                          </span>
                          <span className="font-body text-[12.5px] text-gray-dark">
                            {STATUS_LABEL[membership!.status] ?? membership!.status}
                            {membership!.renewalDate && ` · Renews ${formatDate(membership!.renewalDate)}`}
                          </span>
                        </div>
                      }
                    />

                    {/* Manually-assigned memberships (no stripeSubscriptionId) aren't
                        self-service — there's no subscription to switch or cancel from
                        this side, so those controls only appear for online-billed ones. */}
                    {membership!.stripeSubscriptionId ? (
                      <>
                        {otherPlans.length > 0 && (
                          <div>
                            <p className="mb-2 font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">
                              Available Plans
                            </p>
                            <div className="flex flex-col gap-2">
                              {otherPlans.map((plan) => (
                                <PlanCard
                                  key={plan.id}
                                  plan={plan}
                                  compact
                                  cta={
                                    <form action={changeMembershipTier.bind(null, membership!.id, plan.id)}>
                                      <button
                                        type="submit"
                                        className="min-h-[36px] rounded-full border border-gray-mid px-4 font-sport text-xs font-bold uppercase tracking-wide text-black hover:border-orange hover:text-orange"
                                      >
                                        Change Plan
                                      </button>
                                    </form>
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        <CancelMembershipFlow
                          athleteMembershipId={membership!.id}
                          planName={membership!.plan.name}
                          effectiveDateLabel={formatDate(cancelPreviewDate)}
                          mayRenewBeforeThat={Boolean(
                            membership!.renewalDate &&
                              membership!.renewalDate.getTime() <= cancelPreviewDate.getTime()
                          )}
                        />
                      </>
                    ) : (
                      <p className="font-body text-[13px] text-gray-dark">
                        Set up by The Courts — contact{" "}
                        <a href="mailto:hello@playthecourts.com" className="text-orange hover:text-orange-hover">
                          hello@playthecourts.com
                        </a>{" "}
                        to make changes.
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
