import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { sendRegistrationStaffAlert } from "@/lib/registration-notifications";
import type { MembershipStatus } from "@/generated/prisma/enums";

// Stripe subscription statuses -> our MembershipStatus. `incomplete`/`incomplete_expired`
// mean the first payment never succeeded, which reads the same as a failed renewal to us.
function mapStatus(stripeStatus: Stripe.Subscription.Status): MembershipStatus {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return "past_due";
    case "canceled":
      return "cancelled";
    case "paused":
      return "paused";
    default:
      return "past_due";
  }
}

function renewalDateFrom(subscription: Stripe.Subscription): Date | null {
  const periodEnd = subscription.items.data[0]?.current_period_end;
  return periodEnd ? new Date(periodEnd * 1000) : null;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode === "payment") {
    if (session.metadata?.registrationId) {
      await handleRegistrationCheckoutCompleted(session);
    } else {
      await handleBookingCheckoutCompleted(session);
    }
    return;
  }

  if (session.mode !== "subscription" || !session.subscription) return;

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription.id;

  // Idempotent: Stripe can retry webhook delivery.
  const existing = await prisma.athleteMembership.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });
  if (existing) return;

  const athleteId = session.metadata?.athleteId;
  const membershipPlanId = session.metadata?.membershipPlanId;
  if (!athleteId || !membershipPlanId) {
    console.error("Stripe checkout.session.completed missing athleteId/membershipPlanId metadata", session.id);
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await prisma.athleteMembership.create({
    data: {
      athleteId,
      membershipPlanId,
      status: mapStatus(subscription.status),
      startDate: new Date(),
      renewalDate: renewalDateFrom(subscription),
      stripeSubscriptionId: subscriptionId,
    },
  });
}

// A real per-session/per-offering booking payment — see src/lib/booking.ts'
// createBookingCheckout, which creates the Checkout Session this confirms.
// Best-effort — a receipt link is a nice-to-have, never worth failing (and
// therefore retrying) the payment-confirmation webhook over.
async function receiptUrlFor(session: Stripe.Checkout.Session): Promise<string | null> {
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!paymentIntentId) return null;
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
    const charge = paymentIntent.latest_charge;
    return typeof charge === "string" ? null : (charge?.receipt_url ?? null);
  } catch (err) {
    console.error("Failed to fetch Stripe receipt URL for", session.id, err);
    return null;
  }
}

async function handleBookingCheckoutCompleted(session: Stripe.Checkout.Session) {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) {
    console.error("Stripe checkout.session.completed (payment mode) missing bookingId metadata", session.id);
    return;
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return; // Booking was cancelled/expired before payment confirmed.
  if (booking.paymentStatus === "paid") return; // Idempotent against webhook retries.

  const receiptUrl = await receiptUrlFor(session);

  await prisma.booking.update({
    where: { id: bookingId },
    data: { paymentStatus: "paid", receiptUrl },
  });
}

// Whole-offering registration payment (Fall League today) — see
// src/app/my-courts/league/actions.ts' startLeagueRegistration, which
// creates the Checkout Session this confirms.
async function handleRegistrationCheckoutCompleted(session: Stripe.Checkout.Session) {
  const registrationId = session.metadata?.registrationId;
  if (!registrationId) return;

  const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
  if (!registration) return; // Registration was cancelled before payment confirmed.
  if (registration.paymentStatus === "paid") return; // Idempotent against webhook retries.

  // amountCents is documented as "what the family was actually charged,
  // after member pricing/promo" — session.amount_total is the only place
  // that's actually known (a promo code is entered inside Stripe's own
  // Checkout UI, invisible to us until the session completes).
  const amountCents = session.amount_total ?? registration.amountCents;
  const creditAppliedCents =
    session.amount_subtotal != null && session.amount_total != null && session.amount_subtotal > session.amount_total
      ? session.amount_subtotal - session.amount_total
      : null;
  const receiptUrl = await receiptUrlFor(session);
  const stripePaymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

  await prisma.registration.update({
    where: { id: registrationId },
    data: {
      status: "registered",
      paymentStatus: "paid",
      amountCents,
      creditAppliedCents,
      receiptUrl,
      stripePaymentIntentId,
    },
  });

  // Best-effort — sendEmail swallows its own errors, never blocks this webhook.
  await sendRegistrationStaffAlert(registrationId);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // subscription.cancel_at is how a scheduled cancellation shows up (set by
  // cancelMembership below, or by anyone cancelling directly in the Stripe
  // Dashboard) — `status` stays "active" for the whole notice window, so
  // without syncing this separately the app would show a cancelling
  // membership as fully active right up until the very last second
  // (customer.subscription.deleted, below).
  await prisma.athleteMembership.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: mapStatus(subscription.status),
      renewalDate: renewalDateFrom(subscription),
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await prisma.athleteMembership.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: { status: "cancelled", cancelAt: null },
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return new Response("Missing signature or webhook secret.", { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return new Response("Invalid signature.", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object);
      break;
  }

  return new Response(null, { status: 200 });
}
