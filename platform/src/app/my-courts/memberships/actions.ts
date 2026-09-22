"use server";

import type Stripe from "stripe";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { stripe, getOrCreateStripeCustomer } from "@/lib/stripe";
import { getUnsignedRequiredWaivers } from "@/lib/waivers";
import { CANCELLATION_REASONS } from "./constants";

// ACH costs a small flat fee (capped low) instead of card's ~3% — worth
// making available for recurring membership billing without removing card
// as a choice. Array order here does NOT control which one Stripe's hosted
// Checkout page shows first or pre-selects (confirmed live — Stripe applies
// its own ordering regardless); this only controls which methods are
// offered at all. Subscriptions handle ACH's few-day settlement delay
// safely already: an unpaid first invoice just shows the membership as
// "past_due" until it clears, via the existing customer.subscription.updated
// sync — never granted before it's paid.
const MEMBERSHIP_PAYMENT_METHODS: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = [
  "us_bank_account",
  "card",
];

// Oct 1, 2026, 12:00 AM Central — matches MEMBERSHIP_START in
// league/actions.ts exactly. A membership bought here, standalone, gets the
// same "pay nothing until Oct 1, then bill monthly" treatment as one bundled
// with League — this was the one purchase path that didn't, before now.
const MEMBERSHIP_START = new Date("2026-10-01T05:00:00.000Z");
function isBeforeMembershipStart() {
  return Date.now() < MEMBERSHIP_START.getTime();
}

/// A Current-NextGen family whose existing NextGen billing already lands on
/// a known day of month (staff-entered, from NextGen's own billing export)
/// keeps that same day for their Courts anchor instead of the flat Oct 1
/// everyone else gets — October has 31 days, so any day 1-31 lands validly
/// inside it. Falls back to the flat MEMBERSHIP_START anchor when unset.
function nextGenLegacyAnchor(legacyBillingAnchorDay: number | null): Date {
  if (legacyBillingAnchorDay == null) return MEMBERSHIP_START;
  const day = String(legacyBillingAnchorDay).padStart(2, "0");
  return new Date(`2026-10-${day}T05:00:00.000Z`);
}

async function getOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

/// Every checkout path calls this before creating a new Stripe Checkout
/// Session. The picker UI already hides plan cards once an athlete has a
/// membership, but nothing server-side enforced it — two tabs, or a retried
/// checkout after an abandoned one, could otherwise create two real
/// subscriptions for the same athlete. Throws a plain Error (caught by each
/// caller's own try/catch, same as any other Stripe hiccup) rather than
/// redirecting directly, since callers differ on whether they're already
/// inside a try block.
async function assertNoActiveMembership(athleteId: string) {
  const existing = await prisma.athleteMembership.findFirst({
    where: { athleteId, status: { in: ["active", "past_due"] } },
  });
  if (existing) {
    throw new Error("This athlete already has an active membership.");
  }
}

/// Every membership-mutating action below re-resolves the membership THROUGH
/// the signed-in guardian's athletes, the same shape as requireGuardianAthlete()
/// in athlete-profile.ts — a guardian can never act on another family's
/// subscription by guessing an id.
async function requireGuardianMembership(athleteMembershipId: string) {
  const guardian = await getCurrentGuardian();
  const athleteIds = guardian.families.flatMap((fg) => fg.family.athletes.map((a) => a.id));

  const membership = await prisma.athleteMembership.findFirst({
    where: { id: athleteMembershipId, athleteId: { in: athleteIds } },
    include: { plan: true },
  });
  if (!membership) throw new Error("We couldn't find that membership.");
  if (!membership.stripeSubscriptionId) {
    throw new Error("This membership isn't billed online, so it can't be changed here.");
  }
  return { guardian, membership };
}

export async function startMembershipCheckout(athleteId: string, membershipPlanId: string) {
  const guardian = await getCurrentGuardian();

  const ownsAthlete = guardian.families.some((fg) =>
    fg.family.athletes.some((a) => a.id === athleteId)
  );
  if (!ownsAthlete) {
    throw new Error("Not authorized to act on this athlete.");
  }

  // Every other purchase path (League, session booking) requires this first
  // — standalone membership checkout was the one gap. redirect() throws, so
  // this has to happen before the try/catch below, not inside it.
  const unsigned = await getUnsignedRequiredWaivers(guardian.id, athleteId);
  if (unsigned.length > 0) {
    redirect(
      `/my-courts/waivers?required=membership&back=${encodeURIComponent("/my-courts/memberships")}` +
        `&checkoutKind=standard&checkoutAthleteId=${encodeURIComponent(athleteId)}&checkoutPlanId=${encodeURIComponent(membershipPlanId)}`
    );
  }

  const plan = await prisma.membershipPlan.findUniqueOrThrow({
    where: { id: membershipPlanId },
  });
  if (!plan.stripePriceId) {
    throw new Error("This plan isn't available for online checkout yet.");
  }

  // Defense in depth: Founders is hidden from the picker for anyone who
  // isn't a self-reported current/former NextGen guardian, but a stale page
  // or a crafted request could still try to post this plan id directly.
  if (
    plan.name === "Founders Membership" &&
    guardian.nextGenStatus !== "current_nextgen" &&
    guardian.nextGenStatus !== "former_nextgen"
  ) {
    throw new Error("This plan isn't available for your account.");
  }

  const origin = await getOrigin();
  const beforeStart = isBeforeMembershipStart();

  let checkoutUrl: string;
  try {
    await assertNoActiveMembership(athleteId);
    const customerId = await getOrCreateStripeCustomer(guardian);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: MEMBERSHIP_PAYMENT_METHODS,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${origin}/my-courts/memberships?checkout=success&amount=${plan.priceCents}&plan=${encodeURIComponent(plan.name)}`,
      cancel_url: `${origin}/my-courts/memberships?checkout=cancelled`,
      metadata: { athleteId, membershipPlanId, guardianId: guardian.id },
      subscription_data: {
        metadata: { athleteId, membershipPlanId, guardianId: guardian.id },
        ...(beforeStart
          ? { billing_cycle_anchor: Math.floor(MEMBERSHIP_START.getTime() / 1000), proration_behavior: "none" }
          : {}),
      },
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    checkoutUrl = session.url;
  } catch (err) {
    // A thrown error here crashes the whole page instead of showing a
    // message — the exact bug already fixed once on League registration and
    // once on waiver signing. A Stripe hiccup shouldn't be worse than either.
    console.error("startMembershipCheckout failed", { athleteId, membershipPlanId }, err);
    redirect("/my-courts/memberships?checkout=error");
  }

  redirect(checkoutUrl);
}

/// For a verified Current-NextGen guardian only — their real legacy rate is
/// admin-entered (any dollar amount, not one of the 4 standard plans) and
/// charged via an ad-hoc Stripe price_data line item rather than a fixed
/// Price, same pattern already used for per-session Dr. Dish/booking
/// checkout in lib/booking.ts. This is the ONLY place a Current-NextGen
/// subscription gets created — admin verification never touches Stripe
/// itself (see os/nextgen/actions.ts), since these guardians never entered a
/// card at signup and stripe.subscriptions.create() needs one on file.
export async function startNextGenLegacyCheckout(athleteId: string) {
  const guardian = await getCurrentGuardian();

  const ownsAthlete = guardian.families.some((fg) =>
    fg.family.athletes.some((a) => a.id === athleteId)
  );
  if (!ownsAthlete) {
    throw new Error("Not authorized to act on this athlete.");
  }

  if (
    guardian.nextGenStatus !== "current_nextgen" ||
    guardian.nextGenVerification !== "verified" ||
    guardian.legacyRateCents == null
  ) {
    throw new Error("Your NextGen transfer isn't ready for checkout yet.");
  }

  const unsigned = await getUnsignedRequiredWaivers(guardian.id, athleteId);
  if (unsigned.length > 0) {
    redirect(
      `/my-courts/waivers?required=membership&back=${encodeURIComponent("/my-courts/memberships")}` +
        `&checkoutKind=nextgen_legacy&checkoutAthleteId=${encodeURIComponent(athleteId)}`
    );
  }

  const legacyPlan = await prisma.membershipPlan.findFirstOrThrow({
    where: { name: "NextGen Legacy Rate" },
  });

  const origin = await getOrigin();
  const anchor = nextGenLegacyAnchor(guardian.legacyBillingAnchorDay);
  const beforeStart = Date.now() < anchor.getTime();
  const legacyRateCents = guardian.legacyRateCents;

  let checkoutUrl: string;
  try {
    // A missing config value is exactly the kind of thing that should show
    // this family a normal "something went wrong" message, not crash the
    // page — same reasoning as every other error in this try block.
    const productId = process.env.NEXTGEN_LEGACY_STRIPE_PRODUCT_ID;
    if (!productId) {
      throw new Error("NextGen legacy checkout isn't configured yet.");
    }

    await assertNoActiveMembership(athleteId);
    const customerId = await getOrCreateStripeCustomer(guardian);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: MEMBERSHIP_PAYMENT_METHODS,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: legacyRateCents,
            recurring: { interval: "month" },
            product: productId,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/my-courts/memberships?checkout=success&amount=${legacyRateCents}&plan=${encodeURIComponent("NextGen Legacy Rate")}`,
      cancel_url: `${origin}/my-courts/memberships?checkout=cancelled`,
      metadata: { athleteId, membershipPlanId: legacyPlan.id, guardianId: guardian.id },
      subscription_data: {
        metadata: { athleteId, membershipPlanId: legacyPlan.id, guardianId: guardian.id },
        ...(beforeStart ? { billing_cycle_anchor: Math.floor(anchor.getTime() / 1000), proration_behavior: "none" } : {}),
      },
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    checkoutUrl = session.url;
  } catch (err) {
    console.error("startNextGenLegacyCheckout failed", { athleteId }, err);
    redirect("/my-courts/memberships?checkout=error");
  }

  redirect(checkoutUrl);
}

/// Family Unlimited covers two athletes under one subscription — this is the
/// only plan that does, so it's the only checkout that needs a second
/// athlete picked first. One real Stripe subscription still gets created
/// (billed to the first athlete); the webhook creates a second, unbilled
/// AthleteMembership row for the covered sibling once payment confirms.
export async function startFamilyMembershipCheckout(formData: FormData) {
  const athleteId = String(formData.get("athleteId") ?? "");
  const membershipPlanId = String(formData.get("membershipPlanId") ?? "");
  const secondAthleteId = String(formData.get("secondAthleteId") ?? "");

  const guardian = await getCurrentGuardian();
  const familyAthleteIds = guardian.families.flatMap((fg) => fg.family.athletes.map((a) => a.id));
  if (!familyAthleteIds.includes(athleteId)) {
    throw new Error("Not authorized to act on this athlete.");
  }
  if (!secondAthleteId) {
    throw new Error("Choose which athlete Family Unlimited also covers.");
  }
  if (!familyAthleteIds.includes(secondAthleteId) || secondAthleteId === athleteId) {
    throw new Error("Not authorized to act on that athlete.");
  }

  // Both athletes end up covered by this plan, so both need waivers signed
  // — same gap this had in common with startMembershipCheckout above.
  const [unsignedFirst, unsignedSecond] = await Promise.all([
    getUnsignedRequiredWaivers(guardian.id, athleteId),
    getUnsignedRequiredWaivers(guardian.id, secondAthleteId),
  ]);
  if (unsignedFirst.length > 0 || unsignedSecond.length > 0) {
    redirect(
      `/my-courts/waivers?required=membership&back=${encodeURIComponent("/my-courts/memberships")}` +
        `&checkoutKind=family&checkoutAthleteId=${encodeURIComponent(athleteId)}` +
        `&checkoutPlanId=${encodeURIComponent(membershipPlanId)}&checkoutSecondAthleteId=${encodeURIComponent(secondAthleteId)}`
    );
  }

  const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { id: membershipPlanId } });
  if (!plan.stripePriceId) {
    throw new Error("This plan isn't available for online checkout yet.");
  }

  const origin = await getOrigin();
  const beforeStart = isBeforeMembershipStart();

  let checkoutUrl: string;
  try {
    await Promise.all([assertNoActiveMembership(athleteId), assertNoActiveMembership(secondAthleteId)]);
    const customerId = await getOrCreateStripeCustomer(guardian);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: MEMBERSHIP_PAYMENT_METHODS,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${origin}/my-courts/memberships?checkout=success&amount=${plan.priceCents}&plan=${encodeURIComponent(plan.name)}`,
      cancel_url: `${origin}/my-courts/memberships?checkout=cancelled`,
      metadata: { athleteId, membershipPlanId, secondAthleteId, guardianId: guardian.id },
      subscription_data: {
        metadata: { athleteId, membershipPlanId, secondAthleteId, guardianId: guardian.id },
        ...(beforeStart
          ? { billing_cycle_anchor: Math.floor(MEMBERSHIP_START.getTime() / 1000), proration_behavior: "none" }
          : {}),
      },
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    checkoutUrl = session.url;
  } catch (err) {
    console.error("startFamilyMembershipCheckout failed", { athleteId, membershipPlanId, secondAthleteId }, err);
    redirect("/my-courts/memberships?checkout=error");
  }

  redirect(checkoutUrl);
}

/// Guardian-level, not athlete-level — a Stripe Customer (and so the Billing
/// Portal) belongs to the guardian, covering every athlete's subscriptions
/// billed to that same customer.
export async function startBillingPortalSession() {
  const guardian = await getCurrentGuardian();
  if (!guardian.stripeCustomerId) {
    throw new Error("No billing account on file yet — subscribe to a plan first.");
  }

  const origin = await getOrigin();
  const customerId = await getOrCreateStripeCustomer(guardian);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/my-courts/memberships`,
  });

  redirect(session.url);
}

const CANCELLATION_NOTICE_DAYS = 30;

/// Flat 30 days' notice from the moment of the request — NOT "end of the
/// current billing period" (those can differ substantially either
/// direction). Stripe's `cancel_at` takes an exact future timestamp
/// (distinct from the boolean `cancel_at_period_end`), so the subscription
/// keeps billing normally — including one more renewal if it falls inside
/// the notice window — right up until that moment. The webhook
/// (customer.subscription.updated) re-confirms cancelAt moments after this
/// runs; the write here is so the UI updates instantly instead of waiting
/// on webhook delivery.
export async function cancelMembership(athleteMembershipId: string, formData: FormData) {
  const reason = String(formData.get("reason") ?? "").trim();
  const feedback = String(formData.get("feedback") ?? "").trim();
  if (!CANCELLATION_REASONS.includes(reason as (typeof CANCELLATION_REASONS)[number])) {
    throw new Error("Choose a reason.");
  }

  const { membership } = await requireGuardianMembership(athleteMembershipId);

  const cancelAt = new Date(Date.now() + CANCELLATION_NOTICE_DAYS * 24 * 60 * 60 * 1000);

  await stripe.subscriptions.update(membership.stripeSubscriptionId!, {
    cancel_at: Math.floor(cancelAt.getTime() / 1000),
  });

  await prisma.athleteMembership.update({
    where: { id: membership.id },
    data: {
      cancelAt,
      cancelledAt: new Date(),
      cancellationReason: reason,
      cancellationFeedback: reason === "Didn't meet expectations" && feedback ? feedback : null,
    },
  });

  revalidatePath("/my-courts/memberships");
}

/// Undoes a scheduled (not-yet-effective) cancellation. Once status is
/// actually "cancelled" the Stripe subscription is gone for good — this only
/// works during the notice window.
export async function reverseScheduledCancellation(athleteMembershipId: string) {
  const { membership } = await requireGuardianMembership(athleteMembershipId);

  await stripe.subscriptions.update(membership.stripeSubscriptionId!, {
    cancel_at: null,
  });

  await prisma.athleteMembership.update({
    where: { id: membership.id },
    data: {
      cancelAt: null,
      cancelledAt: null,
      cancellationReason: null,
      cancellationFeedback: null,
    },
  });

  revalidatePath("/my-courts/memberships");
}

export async function changeMembershipTier(athleteMembershipId: string, newPlanId: string) {
  const { membership } = await requireGuardianMembership(athleteMembershipId);

  const newPlan = await prisma.membershipPlan.findUniqueOrThrow({ where: { id: newPlanId } });
  if (!newPlan.stripePriceId) {
    throw new Error("This plan isn't available for online checkout yet.");
  }

  const subscription = await stripe.subscriptions.retrieve(membership.stripeSubscriptionId!);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) throw new Error("Couldn't find the billed item on this subscription.");

  await stripe.subscriptions.update(membership.stripeSubscriptionId!, {
    items: [{ id: itemId, price: newPlan.stripePriceId }],
    proration_behavior: "create_prorations",
  });

  await prisma.athleteMembership.update({
    where: { id: membership.id },
    data: { membershipPlanId: newPlan.id },
  });

  revalidatePath("/my-courts/memberships");
}
