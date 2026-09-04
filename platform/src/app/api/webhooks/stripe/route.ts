import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
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

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  await prisma.athleteMembership.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: mapStatus(subscription.status),
      renewalDate: renewalDateFrom(subscription),
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await prisma.athleteMembership.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: { status: "cancelled" },
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
