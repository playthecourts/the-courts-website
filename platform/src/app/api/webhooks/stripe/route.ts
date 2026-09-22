import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { sendRegistrationStaffAlert, sendRegistrationPaymentFailedAlert } from "@/lib/registration-notifications";
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
    if (session.metadata?.type === "dr_dish_ten_pack") {
      await handleDrDishPackCheckoutCompleted(session);
    } else if (session.metadata?.registrationId) {
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

  // billing_cycle_anchor is Stripe's own record of when this subscription's
  // first real charge lands — reading it back here (rather than re-deriving
  // "was this before Oct 1" locally) means startDate is correct regardless
  // of which checkout path anchored it, standalone or League-bundled.
  const anchorMs = subscription.billing_cycle_anchor * 1000;
  const startDate = anchorMs > Date.now() ? new Date(anchorMs) : new Date();

  const primaryMembership = await prisma.athleteMembership.create({
    data: {
      athleteId,
      membershipPlanId,
      status: mapStatus(subscription.status),
      startDate,
      renewalDate: renewalDateFrom(subscription),
      stripeSubscriptionId: subscriptionId,
    },
  });

  // A Current-NextGen family's legacy-rate subscription (startNextGenLegacyCheckout)
  // keeps its self-reported rate only through Dec 31, 2026 — after that they're
  // real Founders Membership customers at Founders' standard price. Converting
  // the plain subscription into a 2-phase schedule right after Checkout creates
  // it means Stripe enforces that date change on its own; nothing here has to
  // remember to do it later.
  const plan = await prisma.membershipPlan.findUnique({ where: { id: membershipPlanId } });
  if (plan?.name === "NextGen Legacy Rate") {
    await scheduleNextGenLegacyTransition(subscriptionId, subscription).catch((err) => {
      console.error("Failed to schedule NextGen legacy → Founders transition", subscriptionId, err);
    });
  }

  // Family Unlimited covers a second athlete under this same subscription —
  // no separate Stripe object for them, same pattern as any other
  // manually-assigned (no stripeSubscriptionId) membership. linkedMembershipId
  // is set on BOTH rows so the memberships page can show "Also covers: X"
  // instead of two unrelated-looking cards.
  const secondAthleteId = session.metadata?.secondAthleteId;
  if (secondAthleteId) {
    const alreadyCovered = await prisma.athleteMembership.findFirst({
      where: { athleteId: secondAthleteId, membershipPlanId, status: { in: ["active", "past_due"] } },
    });
    if (!alreadyCovered) {
      const siblingMembership = await prisma.athleteMembership.create({
        data: {
          athleteId: secondAthleteId,
          membershipPlanId,
          status: mapStatus(subscription.status),
          startDate,
          renewalDate: renewalDateFrom(subscription),
          linkedMembershipId: primaryMembership.id,
        },
      });
      await prisma.athleteMembership.update({
        where: { id: primaryMembership.id },
        data: { linkedMembershipId: siblingMembership.id },
      });
    }
  }
}

// Dec 31, 2026, 11:59:59 PM Central (CDT, UTC-5) → Jan 1, 2027 00:00 Central.
// The one-time cutoff every Current-NextGen legacy rate transitions at.
const NEXTGEN_LEGACY_CUTOFF = new Date("2027-01-01T06:00:00.000Z");

/// Converts a just-created legacy-rate subscription into a 3-phase schedule:
/// the pre-anchor stub Stripe already creates when billing_cycle_anchor is in
/// the future (unchanged, still no charge), the real legacy-rate period
/// through Dec 31, then Founders Membership's real, standard price from Jan 1
/// onward with no end date — Stripe just keeps renewing at that price once
/// the schedule releases, same as any other subscription. proration_behavior
/// "none" on every phase matches the anchor idiom used everywhere else in
/// this app: no surprise mid-cycle charge at either boundary.
async function scheduleNextGenLegacyTransition(subscriptionId: string, subscription: Stripe.Subscription) {
  const foundersPlan = await prisma.membershipPlan.findFirst({ where: { name: "Founders Membership" } });
  if (!foundersPlan?.stripePriceId) {
    console.error("Founders Membership plan has no stripePriceId — cannot schedule NextGen transition", subscriptionId);
    return;
  }

  const legacyItem = subscription.items.data[0];
  if (!legacyItem) return;
  const legacyPriceId = typeof legacyItem.price === "string" ? legacyItem.price : legacyItem.price.id;
  const anchor = subscription.billing_cycle_anchor;
  const cutoff = Math.floor(NEXTGEN_LEGACY_CUTOFF.getTime() / 1000);

  const schedule = await stripe.subscriptionSchedules.create({ from_subscription: subscriptionId });
  const stubStart = schedule.phases[0]?.start_date ?? anchor;

  // Only keep the pre-anchor stub phase when there really is one (checkout
  // happened before Oct 1, so billing_cycle_anchor was still in the future).
  // A legacy checkout completed after Oct 1 has no future anchor at all —
  // from_subscription then returns a single phase whose start already equals
  // "now", and inserting a second zero-length phase on top of it would be
  // invalid.
  const legacyPhase = { items: [{ price: legacyPriceId, quantity: 1 }], start_date: anchor, end_date: cutoff, proration_behavior: "none" as const };
  const foundersPhase = { items: [{ price: foundersPlan.stripePriceId, quantity: 1 }], start_date: cutoff, proration_behavior: "none" as const };
  const phases =
    stubStart < anchor
      ? [
          { items: [{ price: legacyPriceId, quantity: 1 }], start_date: stubStart, end_date: anchor, proration_behavior: "none" as const },
          legacyPhase,
          foundersPhase,
        ]
      : [legacyPhase, foundersPhase];

  await stripe.subscriptionSchedules.update(schedule.id, { end_behavior: "release", phases });

  // Defensive verification: a real case (Daniel Gwydir, Sept 2026) showed
  // Stripe can silently keep the ALREADY-STARTED phase's original item price
  // instead of the one we just set, even though this update call reported
  // success and every later phase was correct. Rather than trust the
  // response, re-read the live subscription and force-correct the current
  // item if it doesn't match what phases[0] actually asked for — cheap,
  // and it's the only way to guarantee a family's real bill matches what
  // this function just configured.
  const expectedCurrentPriceId = phases[0].items[0].price;
  const verify = await stripe.subscriptions.retrieve(subscriptionId);
  const actualCurrentPriceId =
    typeof verify.items.data[0].price === "string" ? verify.items.data[0].price : verify.items.data[0].price.id;
  if (actualCurrentPriceId !== expectedCurrentPriceId) {
    console.error(
      "NextGen legacy schedule left the live subscription on the wrong price — correcting",
      { subscriptionId, expected: expectedCurrentPriceId, was: actualCurrentPriceId }
    );
    const itemId = verify.items.data[0].id;
    await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: itemId, price: expectedCurrentPriceId }],
      proration_behavior: "none",
    });
  }
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

// Dr. Dish 10-pack — see purchaseDrDishTenPack in my-courts/actions.ts, which
// creates the Checkout Session this confirms. Idempotent on the Checkout
// Session id itself, since a pack purchase has no other row to check against
// before this webhook creates the first one.
async function handleDrDishPackCheckoutCompleted(session: Stripe.Checkout.Session) {
  const athleteId = session.metadata?.athleteId;
  if (!athleteId) {
    console.error("Stripe checkout.session.completed (dr_dish_ten_pack) missing athleteId metadata", session.id);
    return;
  }

  const existing = await prisma.credit.findFirst({
    where: { athleteId, creditType: "dr_dish_ten_pack", source: session.id },
  });
  if (existing) return; // Idempotent against webhook retries.

  const program = await prisma.program.findFirst({ where: { programType: "self_serve_dr_dish" } });

  const credit = await prisma.credit.create({
    data: {
      athleteId,
      creditType: "dr_dish_ten_pack",
      balance: 10,
      source: session.id,
      eligibleProgramId: program?.id ?? null,
      status: "issued",
    },
  });
  await prisma.creditLedgerEntry.create({
    data: { creditId: credit.id, delta: 10, balanceAfter: 10, reason: "Dr. Dish Non-Member 10-Pack purchased" },
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

// Safety-net for the League+Membership bundle (src/app/my-courts/league/actions.ts):
// confirmLeagueRegistration already marks the Registration paid synchronously
// right after stripe.confirmPayment() resolves client-side, so this is almost
// always a no-op — it exists for the case where that write never happened
// (the server crashed between the charge succeeding and the DB write), which
// is exactly the gap "don't rely on the redirect alone" is about even though
// this flow has no redirect to lose track of.
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const registrationId = paymentIntent.metadata?.registrationId;
  if (!registrationId) return; // Not a League PaymentIntent (e.g. a booking payment) — ignore.

  const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
  if (!registration) return;
  if (registration.paymentStatus === "paid") return; // Idempotent — already handled.

  await prisma.registration.update({
    where: { id: registrationId },
    data: { status: "registered", paymentStatus: "paid" },
  });
}

// A declined League card leaves the registration row stuck at "pending"
// otherwise, with no staff-visible trace that a family even tried — the
// client-side confirmPayment() error handling shows the family the decline
// in the moment, but nothing server-side recorded it before this existed.
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const registrationId = paymentIntent.metadata?.registrationId;
  if (!registrationId) return; // Not a League PaymentIntent — ignore.

  const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
  if (!registration || registration.paymentStatus === "paid") return; // Already resolved.

  await prisma.registration.update({
    where: { id: registrationId },
    data: { paymentStatus: "failed" },
  });

  await sendRegistrationPaymentFailedAlert(
    registrationId,
    paymentIntent.last_payment_error?.message ?? null
  );
}

// Same safety-net role as handlePaymentIntentSucceeded, for the bundled
// membership subscription side — createBundledMembershipSubscription
// already writes the AthleteMembership row synchronously on success.
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  if (subscription.metadata?.source !== "league_bundle") return;

  const existing = await prisma.athleteMembership.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (existing) return; // Already written by createBundledMembershipSubscription.

  const athleteId = subscription.metadata.athleteId;
  const membershipPlanId = subscription.metadata.membershipPlanId;
  if (!athleteId || !membershipPlanId) return;

  await prisma.athleteMembership.create({
    data: {
      athleteId,
      membershipPlanId,
      status: mapStatus(subscription.status),
      startDate: new Date(subscription.billing_cycle_anchor * 1000),
      renewalDate: renewalDateFrom(subscription),
      stripeSubscriptionId: subscription.id,
    },
  });
}

// invoice.paid fires for every subscription renewal, including the first
// real Oct 1 charge for a bundled membership — this is what keeps
// renewalDate accurate going forward (handleSubscriptionUpdated also fires
// around the same time, but an invoice event is the more direct signal that
// a specific charge actually landed).
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId =
    typeof (invoice as unknown as { subscription?: string | Stripe.Subscription | null }).subscription === "string"
      ? (invoice as unknown as { subscription: string }).subscription
      : (invoice as unknown as { subscription?: Stripe.Subscription | null }).subscription?.id;
  if (!subscriptionId) return;

  await prisma.athleteMembership.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: { status: "active" },
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId =
    typeof (invoice as unknown as { subscription?: string | Stripe.Subscription | null }).subscription === "string"
      ? (invoice as unknown as { subscription: string }).subscription
      : (invoice as unknown as { subscription?: Stripe.Subscription | null }).subscription?.id;
  if (!subscriptionId) return;

  await prisma.athleteMembership.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: { status: "past_due" },
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // Which local plan this subscription's CURRENT price actually matches, if
  // any — the signal that a scheduled phase transition (see
  // scheduleNextGenLegacyTransition above) has taken effect on Stripe's
  // side. An ad-hoc price_data price (the legacy rate itself) never matches
  // a real catalog plan, so this only fires once Stripe has actually moved
  // the subscription onto Founders' real Price — never speculatively.
  const currentItem = subscription.items.data[0];
  const currentPriceId = currentItem
    ? typeof currentItem.price === "string" ? currentItem.price : currentItem.price.id
    : null;
  const matchedPlan = currentPriceId
    ? await prisma.membershipPlan.findFirst({ where: { stripePriceId: currentPriceId } })
    : null;

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
      ...(matchedPlan ? { membershipPlanId: matchedPlan.id } : {}),
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
    case "payment_intent.succeeded":
      await handlePaymentIntentSucceeded(event.data.object);
      break;
    case "payment_intent.payment_failed":
      await handlePaymentIntentFailed(event.data.object);
      break;
    case "customer.subscription.created":
      await handleSubscriptionCreated(event.data.object);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object);
      break;
    case "invoice.paid":
      await handleInvoicePaid(event.data.object);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object);
      break;
  }

  return new Response(null, { status: 200 });
}
