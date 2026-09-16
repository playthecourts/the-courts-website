import type { ReactNode } from "react";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import {
  changeMembershipTier,
  reverseScheduledCancellation,
  startBillingPortalSession,
  startMembershipCheckout,
  startNextGenLegacyCheckout,
} from "./actions";
import { FamilyPlanSelector } from "./family-plan-selector";
import { CancelMembershipFlow } from "./cancel-flow";
import { GaConversionEvent } from "@/components/ga-conversion-event";

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

const FAMILY_PLAN_NAME = "Family Unlimited Membership";

const PLAN_COPY: Record<string, { tagline: string; description: string; mostPopular?: boolean }> = {
  "Weekly Membership": {
    tagline: "Your schedule. Your four.",
    description: "4 group training sessions per billing cycle. Unused sessions don't roll over.",
  },
  "Unlimited Membership": {
    tagline: "Come a lot.",
    description: "Unlimited group training, plus quarterly progress updates.",
    mostPopular: true,
  },
  "Full Court Membership": {
    tagline: "Okay. You're serious.",
    description:
      "Unlimited group training and quarterly progress updates, plus 1 private training session and 2 Dr. Dish sessions each billing cycle.",
  },
  [FAMILY_PLAN_NAME]: {
    tagline: "Bring the whole crew.",
    description: "Unlimited group training and quarterly progress updates for 2 athletes. Add more for $100/mo each.",
  },
  "Founders Membership": {
    tagline: "You were here first.",
    description: "The same access as Unlimited — unlimited group training, plus member pricing on Private Training, Dr. Dish, and Camps.",
  },
};

type PlanRow = { id: string; name: string; priceCents: number; billingInterval: string };

function PlanCard({
  plan,
  cta,
  badge,
  priceOverrideCents,
}: {
  plan: PlanRow;
  cta: ReactNode;
  /// Overrides the "Most Popular" pill when set — used to recommend Founders
  /// Membership to a former_nextgen guardian without touching the plan's own
  /// static copy (which stays guardian-independent).
  badge?: string;
  /// The "NextGen Legacy Rate" placeholder plan's priceCents is always 0 —
  /// the real amount lives on Guardian.legacyRateCents, threaded in here so
  /// it displays correctly instead of "$0.00/mo".
  priceOverrideCents?: number;
}) {
  const shortName = plan.name.replace(/\s+Membership$/, "");
  const copy = PLAN_COPY[plan.name];
  const displayPriceCents = priceOverrideCents ?? plan.priceCents;
  const badgeText = badge ?? (copy?.mostPopular ? "Most Popular" : null);

  return (
    <div className="rounded-lg border border-gray-mid bg-white p-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="font-heading font-bold text-black">{shortName}</p>
        <p className="font-body text-sm text-gray-dark">{formatPrice(displayPriceCents, plan.billingInterval)}</p>
        {badgeText && (
          <span className="rounded-full bg-orange/10 px-2 py-0.5 font-sport text-[10px] font-bold uppercase tracking-wide text-orange">
            {badgeText}
          </span>
        )}
      </div>
      {copy && (
        <>
          <p className="mt-1.5 font-body text-[13.5px] italic text-gray-dark">{copy.tagline}</p>
          <p className="mt-1 font-body text-[13.5px] leading-snug text-gray-dark">{copy.description}</p>
        </>
      )}
      <div className="mt-3">{cta}</div>
    </div>
  );
}

function PlansIntro({ athleteFirstName }: { athleteFirstName: string }) {
  return (
    <div className="mb-1">
      <p className="font-sport text-xs font-bold uppercase tracking-wide text-gray-dark">
        Plans for {athleteFirstName}
      </p>
      <p className="mt-1 font-body text-[12.5px] leading-snug text-gray-dark">
        All plans include member pricing on Private Training, Dr. Dish, and Camps.
      </p>
      <p className="font-body text-[12.5px] leading-snug text-gray-dark">
        No long-term commitment. Cancel with 30 days&rsquo; notice.
      </p>
    </div>
  );
}

type TransferGuardian = { nextGenVerification: string | null; legacyRateCents: number | null };

function NextGenTransferState({ guardian, athlete }: { guardian: TransferGuardian; athlete: { id: string } }) {
  if (guardian.nextGenVerification !== "verified" || guardian.legacyRateCents == null) {
    return (
      <div className="rounded-lg border border-orange bg-orange/5 p-4">
        <p className="font-heading font-bold text-black">NextGen Membership Transfer Pending</p>
        <p className="mt-1 font-body text-sm text-gray-dark">
          We&rsquo;re confirming your account against NextGen&rsquo;s official member list. Once verified, your real
          rate will appear here and you&rsquo;ll be able to complete checkout yourself — no action needed from you
          right now.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-orange bg-orange/5 p-4">
      <p className="font-heading font-bold text-black">Your NextGen Rate Is Confirmed</p>
      <p className="mt-1 font-body text-sm text-gray-dark">
        ${(guardian.legacyRateCents / 100).toFixed(2)}/mo, same as your NextGen rate. Complete checkout to start your
        membership at The Courts.
      </p>
      <form action={startNextGenLegacyCheckout.bind(null, athlete.id)} className="mt-3">
        <button
          type="submit"
          className="min-h-[36px] rounded-full bg-orange px-4 font-sport text-xs font-bold uppercase tracking-wide text-white hover:bg-orange-hover"
        >
          Complete Your Transfer — ${(guardian.legacyRateCents / 100).toFixed(2)}/mo
        </button>
      </form>
    </div>
  );
}

export default async function MembershipsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; required?: string; athlete?: string; amount?: string; plan?: string }>;
}) {
  const { checkout, required, athlete: requiredAthleteId, amount, plan: purchasedPlanName } = await searchParams;
  const guardian = await getCurrentGuardian();
  const athletes = guardian.families.flatMap((fg) => fg.family.athletes);
  const requiredForAthlete = requiredAthleteId ? athletes.find((a) => a.id === requiredAthleteId) : null;

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

  // Computed once for the whole render, not per-athlete-row: the actual
  // cancellation date is decided server-side at submit time in
  // cancelMembership — this is only a preview, and every row previewing the
  // same moment is more honest than each one drifting by milliseconds.
  const now = new Date();
  const cancelPreviewDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  function planCta(athleteId: string, plan: PlanRow) {
    if (plan.name === FAMILY_PLAN_NAME) {
      return (
        <FamilyPlanSelector
          athleteId={athleteId}
          membershipPlanId={plan.id}
          otherAthletes={athletes.filter((a) => a.id !== athleteId).map((a) => ({ id: a.id, firstName: a.firstName }))}
        />
      );
    }
    return (
      <form action={startMembershipCheckout.bind(null, athleteId, plan.id)}>
        <button
          type="submit"
          className="min-h-[36px] rounded-full bg-black px-4 font-sport text-xs font-bold uppercase tracking-wide text-white hover:bg-orange"
        >
          Select Plan
        </button>
      </form>
    );
  }

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

      {required === "league" && requiredForAthlete && (
        <div className="rounded-lg border border-orange bg-orange/5 p-4 font-body text-sm text-neutral-800">
          Fall League requires a Weekly membership or higher. Choose a plan for{" "}
          <strong>{requiredForAthlete.firstName}</strong>.
        </div>
      )}

      {checkout === "success" && (
        <>
          <GaConversionEvent
            event="purchase"
            valueCents={amount ? Number(amount) : null}
            itemName={purchasedPlanName ?? "Membership"}
          />
          <p className="rounded-lg border border-orange bg-white px-4 py-3 font-body text-sm text-black">
            You&rsquo;re in — your Membership is active.
          </p>
        </>
      )}
      {checkout === "cancelled" && (
        <p className="rounded-lg border border-gray-mid bg-white px-4 py-3 font-body text-sm text-gray-dark">
          Checkout was cancelled — no charge was made.
        </p>
      )}
      {checkout === "error" && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700">
          Something went wrong setting up checkout — nothing was charged. Try again, or contact us if it keeps
          happening.
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

                {!membership && guardian.nextGenStatus === "current_nextgen" && (
                  <NextGenTransferState guardian={guardian} athlete={athlete} />
                )}

                {!membership && guardian.nextGenStatus !== "current_nextgen" && (
                  <div className="flex flex-col gap-3">
                    <PlansIntro athleteFirstName={athlete.firstName} />
                    {plans.length === 0 ? (
                      <p className="font-body text-sm text-gray-dark">No plans available for checkout yet.</p>
                    ) : (
                      plans.map((plan) => (
                        <PlanCard
                          key={plan.id}
                          plan={plan}
                          cta={planCta(athlete.id, plan)}
                          badge={
                            guardian.nextGenStatus === "former_nextgen" && plan.name === "Founders Membership"
                              ? "Recommended for NextGen Families"
                              : undefined
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
                    {guardian.nextGenStatus === "current_nextgen" ? (
                      <NextGenTransferState guardian={guardian} athlete={athlete} />
                    ) : (
                      <>
                        <PlansIntro athleteFirstName={athlete.firstName} />
                        {plans.map((plan) => (
                          <PlanCard
                            key={plan.id}
                            plan={plan}
                            cta={planCta(athlete.id, plan)}
                            badge={
                              guardian.nextGenStatus === "former_nextgen" && plan.name === "Founders Membership"
                                ? "Recommended for NextGen Families"
                                : undefined
                            }
                          />
                        ))}
                      </>
                    )}
                  </div>
                )}

                {hasCurrentPlan && !membership!.cancelAt && (
                  <div className="flex flex-col gap-4">
                    {(() => {
                      // A membership bundled in through League checkout can have
                      // status "active" in Stripe's sense (the subscription
                      // exists and is scheduled) while its startDate is still in
                      // the future — Oct 1. Show that distinctly rather than
                      // claiming it's already active today.
                      const startsInFuture = membership!.startDate.getTime() > now.getTime();
                      return (
                        <PlanCard
                          plan={membership!.plan}
                          priceOverrideCents={
                            membership!.plan.name === "NextGen Legacy Rate" ? (guardian.legacyRateCents ?? 0) : undefined
                          }
                          cta={
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-block rounded-full px-2.5 py-1 font-sport text-[10.5px] font-bold uppercase tracking-wide ${
                                  startsInFuture ? "bg-orange/10 text-orange" : "bg-green-100 text-green-800"
                                }`}
                              >
                                {startsInFuture ? `Starts ${formatDate(membership!.startDate)}` : "Current Plan"}
                              </span>
                              <span className="font-body text-[12.5px] text-gray-dark">
                                {startsInFuture ? "You're In ✓" : (STATUS_LABEL[membership!.status] ?? membership!.status)}
                                {!startsInFuture &&
                                  membership!.renewalDate &&
                                  ` · Renews ${formatDate(membership!.renewalDate)}`}
                              </span>
                            </div>
                          }
                        />
                      );
                    })()}

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
