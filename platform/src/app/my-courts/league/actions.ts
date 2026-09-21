"use server";

import { revalidatePath } from "next/cache";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { stripe, getOrCreateStripeCustomer } from "@/lib/stripe";
import {
  sendMembershipSetupFailedAlert,
  sendRegistrationStaffAlert,
  sendRegistrationConfirmationEmail,
} from "@/lib/registration-notifications";

// Oct 1, 2026, 12:00 AM Central (CDT, UTC-5 — DST is still in effect on this
// date). Both the billing anchor for a bundled membership and the cutoff
// that switches "anchor to Oct 1" over to "bill today" once the season has
// actually started.
const MEMBERSHIP_START = new Date("2026-10-01T05:00:00.000Z");
const WEEKLY_PLAN_NAME = "Weekly Membership";

// A standalone Stripe payment method configuration (card only — no ACH, no
// wallets), separate from the account default. Using this instead of a raw
// payment_method_types array puts the PaymentIntent back in Stripe's
// "dynamic" mode, which is what Stripe.js's Payment Element needs to
// reliably fetch its element-session config and actually render card
// fields — a fixed payment_method_types array was confirmed (via real
// stuck PaymentIntents for real families) to leave the Payment Element
// silently unmounted, with no error, no card fields, and no way to pay.
// This keeps the original ACH-safety intent (see the payment_method_types
// comment this replaced) without going back to automatic_payment_methods,
// which would pull ACH back in now that it's on account-wide.
const CARD_ONLY_PAYMENT_METHOD_CONFIGURATION = "pmc_1UGN0qKqZ4a13U82pgk1s4MD";

function isBeforeMembershipStart() {
  return Date.now() < MEMBERSHIP_START.getTime();
}

/// Step 1 of League checkout: validates the athlete, creates/updates the
/// Registration row, and creates a Stripe PaymentIntent for the League total
/// (after the EVAL25 credit). Returns what the client needs to render the
/// Payment Element and the review screen. Nothing is charged yet — that
/// happens when the guardian submits the card via stripe.confirmPayment()
/// client-side, then confirmLeagueRegistration (below) finishes the job.
export async function createLeaguePaymentIntent(athleteId: string) {
  const guardian = await getCurrentGuardian();
  const athlete = guardian.families
    .flatMap((fg) => fg.family.athletes)
    .find((a) => a.id === athleteId);
  if (!athlete) {
    throw new Error("Not authorized to act on this athlete.");
  }

  // Waivers are intentionally not required for League registration.

  const offering = await prisma.offering.findFirstOrThrow({
    where: { name: "Fall 2026 Basketball League" },
  });

  // League registration and membership are separate purchases — no bundled
  // subscription gets created here (see git history for the prior bundled
  // flow, removed because it forced every League family onto card-only
  // billing with no ACH option, even for families who'd otherwise pay
  // membership by bank transfer).
  const registration = await prisma.registration.upsert({
    where: { offeringId_athleteId: { offeringId: offering.id, athleteId } },
    create: {
      offeringId: offering.id,
      athleteId,
      selection: "team_season",
      status: "started",
      paymentStatus: "pending",
      amountCents: offering.priceCents,
    },
    update: {
      status: "started",
      paymentStatus: "pending",
      amountCents: offering.priceCents,
      cancelledAt: null,
    },
  });

  const customerId = await getOrCreateStripeCustomer(guardian);

  // No automatic EVAL25 discount here — families are responsible for
  // entering their own promo code (Melissa emailed it out directly), not
  // having it silently applied. See applyLeaguePromoCode below.
  const base = offering.priceCents ?? 0;
  const total = base;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: total,
    currency: "usd",
    customer: customerId,
    // Saves the card to the customer on success so the bundled subscription
    // (or a later "finish setting up membership" retry) can charge it
    // off-session — the guardian only enters their card once.
    setup_future_usage: "off_session",
    // Card only, via a dedicated configuration rather than a fixed
    // payment_method_types array — see the constant's comment above. This
    // still keeps out redirect-based methods (no return_url handling here)
    // and ACH (this webhook confirms the seat the moment confirmPayment()
    // reports success, which isn't safe for a payment method that can still
    // fail days later).
    payment_method_configuration: CARD_ONLY_PAYMENT_METHOD_CONFIGURATION,
    description: `Fall League Registration — ${athlete.firstName} ${athlete.lastName}`,
    metadata: {
      registrationId: registration.id,
      athleteId,
      guardianId: guardian.id,
    },
  });

  await prisma.registration.update({
    where: { id: registration.id },
    data: { stripePaymentIntentId: paymentIntent.id, amountCents: total, creditAppliedCents: null },
  });

  return {
    clientSecret: paymentIntent.client_secret!,
    registrationId: registration.id,
    athleteFirstName: athlete.firstName,
    baseAmountCents: base,
    creditCents: 0,
    totalCents: total,
  };
}

/// Applies a promo code the guardian typed in themselves (e.g. EVAL25) to an
/// already-created, not-yet-paid PaymentIntent — lowers its amount directly
/// via the Stripe API, so whatever the family actually confirms is the
/// discounted total. Re-checks ownership and payment status the same as
/// every other action here; safe to call more than once (re-validates and
/// re-applies against the current base price each time, doesn't stack).
export async function applyLeaguePromoCode(
  registrationId: string,
  rawCode: string
): Promise<{ ok: true; totalCents: number; creditCents: number } | { ok: false; error: string }> {
  const guardian = await getCurrentGuardian();
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { offering: true },
  });
  if (!registration) throw new Error("Registration not found.");
  const ownsAthlete = guardian.families.some((fg) =>
    fg.family.athletes.some((a) => a.id === registration.athleteId)
  );
  if (!ownsAthlete) throw new Error("Not authorized to act on this athlete.");
  if (!registration.stripePaymentIntentId) {
    return { ok: false, error: "Start registration before applying a code." };
  }
  if (registration.paymentStatus === "paid") {
    return { ok: false, error: "This registration is already paid." };
  }

  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a promo code." };

  // Same account-specific shape as the fix above: promotion.coupon is a
  // coupon id, not the coupon object.
  const matches = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
  const promo = matches.data[0] as unknown as { promotion?: { coupon?: string } } | undefined;
  const couponId = promo?.promotion?.coupon;
  if (!promo || !couponId) {
    return { ok: false, error: "That promo code isn't valid." };
  }
  const coupon = await stripe.coupons.retrieve(couponId);

  const base = registration.offering.priceCents ?? 0;
  const amountOff = coupon.amount_off ?? (coupon.percent_off ? Math.round((base * coupon.percent_off) / 100) : 0);
  const total = Math.max(base - amountOff, 0);

  await stripe.paymentIntents.update(registration.stripePaymentIntentId, { amount: total });
  await prisma.registration.update({
    where: { id: registrationId },
    data: { amountCents: total, creditAppliedCents: amountOff || null },
  });

  return { ok: true, totalCents: total, creditCents: amountOff };
}

/// Step 2: called client-side right after stripe.confirmPayment() resolves.
/// Never trusts the client's word that payment succeeded — re-checks the
/// PaymentIntent with Stripe directly before writing anything. League and
/// membership are separate purchases (no bundling — see git history), so
/// this just confirms the League charge and stops.
export async function confirmLeagueRegistration(
  registrationId: string,
  paymentIntentId: string
): Promise<{ ok: true; membershipSetupNeeded: boolean } | { ok: false; error: string }> {
  const guardian = await getCurrentGuardian();
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { athlete: true },
  });
  if (!registration || registration.stripePaymentIntentId !== paymentIntentId) {
    throw new Error("Registration/payment mismatch.");
  }
  const ownsAthlete = guardian.families.some((fg) =>
    fg.family.athletes.some((a) => a.id === registration.athleteId)
  );
  if (!ownsAthlete) throw new Error("Not authorized to act on this athlete.");

  // Idempotent — a guardian refreshing the confirmation step, or this action
  // firing twice, must never double-process.
  if (registration.paymentStatus === "paid") {
    return { ok: true, membershipSetupNeeded: registration.membershipSetupNeeded };
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status !== "succeeded") {
    return { ok: false, error: "Payment hasn't completed yet." };
  }

  await prisma.registration.update({
    where: { id: registrationId },
    data: { status: "registered", paymentStatus: "paid" },
  });

  await sendRegistrationConfirmationEmail(registrationId);
  await sendRegistrationStaffAlert(registrationId);

  revalidatePath("/my-courts/league");
  return { ok: true, membershipSetupNeeded: false };
}

async function createBundledMembershipSubscription({
  guardianId,
  athleteId,
  membershipPlanId,
  paymentIntentId,
}: {
  guardianId: string;
  athleteId: string;
  membershipPlanId: string;
  paymentIntentId: string;
}) {
  const guardian = await prisma.guardian.findUniqueOrThrow({ where: { id: guardianId } });
  const plan = await prisma.membershipPlan.findUniqueOrThrow({ where: { id: membershipPlanId } });
  if (!guardian.stripeCustomerId || !plan.stripePriceId) {
    throw new Error("Missing Stripe customer or plan price.");
  }

  // The card just used for the League PaymentIntent is on the customer now
  // (setup_future_usage: "off_session") — make it the default so the
  // subscription bills it automatically, no second card entry.
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const paymentMethodId =
    typeof paymentIntent.payment_method === "string"
      ? paymentIntent.payment_method
      : paymentIntent.payment_method?.id;
  if (paymentMethodId) {
    await stripe.customers.update(guardian.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }

  const beforeStart = isBeforeMembershipStart();
  const subscription = await stripe.subscriptions.create({
    customer: guardian.stripeCustomerId,
    items: [{ price: plan.stripePriceId }],
    ...(beforeStart
      ? { billing_cycle_anchor: Math.floor(MEMBERSHIP_START.getTime() / 1000), proration_behavior: "none" }
      : {}),
    metadata: { athleteId, membershipPlanId, guardianId, source: "league_bundle" },
  });

  await prisma.athleteMembership.create({
    data: {
      athleteId,
      membershipPlanId,
      status: "active",
      startDate: beforeStart ? MEMBERSHIP_START : new Date(),
      renewalDate: subscription.items.data[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000)
        : null,
      stripeSubscriptionId: subscription.id,
    },
  });
}

/// Retries the bundled membership only, using the card already saved on the
/// guardian's Stripe customer — the League registration is already paid and
/// untouched. Surfaced from the "Finish setting up [Name]'s membership"
/// Action Needed item.
export async function retryMembershipSetup(registrationId: string) {
  const guardian = await getCurrentGuardian();
  const registration = await prisma.registration.findUniqueOrThrow({ where: { id: registrationId } });
  const ownsAthlete = guardian.families.some((fg) =>
    fg.family.athletes.some((a) => a.id === registration.athleteId)
  );
  if (!ownsAthlete) throw new Error("Not authorized to act on this athlete.");
  if (!registration.stripePaymentIntentId) throw new Error("No payment on file for this registration.");

  const weeklyPlan = await prisma.membershipPlan.findFirstOrThrow({ where: { name: WEEKLY_PLAN_NAME } });

  try {
    await createBundledMembershipSubscription({
      guardianId: guardian.id,
      athleteId: registration.athleteId,
      membershipPlanId: weeklyPlan.id,
      paymentIntentId: registration.stripePaymentIntentId,
    });
    await prisma.registration.update({ where: { id: registrationId }, data: { membershipSetupNeeded: false } });
    revalidatePath("/my-courts");
    revalidatePath("/my-courts/memberships");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error creating the subscription.";
    await sendMembershipSetupFailedAlert(registrationId, message);
    return { ok: false, error: message };
  }
}

/// Withdraws a League registration — only before payment. Once paid,
/// registration is locked in: League never refunds, so "withdrawing" a paid
/// registration would give up the seat for nothing. This just lets a family
/// back out of a registration they started but haven't paid for yet.
export async function cancelLeagueRegistration(athleteId: string) {
  const guardian = await getCurrentGuardian();
  const ownsAthlete = guardian.families.some((fg) =>
    fg.family.athletes.some((a) => a.id === athleteId)
  );
  if (!ownsAthlete) {
    throw new Error("Not authorized to act on this athlete.");
  }

  const offering = await prisma.offering.findFirstOrThrow({
    where: { name: "Fall 2026 Basketball League" },
  });

  await prisma.registration.updateMany({
    where: {
      offeringId: offering.id,
      athleteId,
      status: { not: "cancelled" },
      paymentStatus: { not: "paid" },
    },
    data: { status: "cancelled", cancelledAt: new Date() },
  });

  revalidatePath("/my-courts/league");
}
