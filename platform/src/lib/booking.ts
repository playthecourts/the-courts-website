import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getBookingEligibility } from "@/lib/entitlements";
import { resolveBookingRule } from "@/lib/programs/pricing";
import { offerNextSpot } from "@/lib/programs/waitlist";
import { stripe } from "@/lib/stripe";

const CHECKOUT_EXPIRY_MINUTES = 30;

// The facility opens Oct 1, 2026. Regular group training is the one program
// type deliberately not sold before then — matches GROUP_TRAINING_BOOKING_OPENS
// in offering-session-card.tsx, which hides the Book button for the same
// reason. This check is the one that actually matters: a hidden button is a
// UX nicety, not protection against a crafted request.
const GROUP_TRAINING_BOOKING_OPENS = new Date("2026-10-01T05:00:00.000Z");

// creditSource holds a plan name string for a membership entitlement booking,
// or a real Credit row id for a pack-credit booking (see resolveBookingRule's
// uses_pack_credit case) — the two are told apart by shape, not a second
// column, so anything not UUID-shaped is never even sent to the credits
// table as an id (Postgres would reject it outright rather than just miss).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

// Shared booking logic used by both the guardian-facing action (after
// authorization) and, later, any admin-initiated booking. A raw
// `SELECT ... FOR UPDATE` on the session row serializes concurrent booking
// attempts for the same session so capacity can never be oversold — a
// plain count-then-create has a race window under concurrent requests.
export async function bookAthleteIntoSession(
  sessionId: string,
  athleteId: string,
  bookedByGuardianId: string | null
) {
  // Computed outside the transaction: pricing queries via the plain prisma
  // client, not the tx client below. A price computed a moment before the
  // capacity check is committed is an acceptable staleness window (worst
  // case: a slightly wrong charged price to fix manually) — unlike the
  // capacity check itself, which must never be stale.
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: { offering: { include: { program: true } } },
  });

  // A per-session Book button only ever means "buy this one occurrence."
  // Camps sold as a package (multi_day/offering) and League (season) are
  // registered through their own dedicated flows — booking them one session
  // at a time here would charge the full package price per session, with
  // nothing stopping a family from doing it more than once for the same
  // camp. See GROUP_TRAINING_BOOKING_OPENS below for the other gate.
  if (session.offeringId && session.offering && session.offering.registrationMode !== "session") {
    throw new Error("This isn't booked one session at a time — contact us to register.");
  }
  if (
    session.offeringId &&
    session.offering?.program.programType === "group_training" &&
    new Date() < GROUP_TRAINING_BOOKING_OPENS
  ) {
    throw new Error("Booking opens October 1, 2026 — check back then.");
  }

  let priceChargedCents: number | null;
  let needsPayment: boolean;
  // Which Training Plan benefit paid for this seat, if any — recorded so a
  // cancellation later knows whether there's a credit to potentially restore.
  // Null for a free/paid booking, which never touched a credit.
  let creditSource: string | null = null;
  if (session.offeringId) {
    const currentBookedCount = await prisma.booking.count({
      where: { sessionId, status: { not: "cancelled" } },
    });
    const rule = await resolveBookingRule(athleteId, session.offeringId, session.startTime, currentBookedCount);
    needsPayment = rule.kind === "full_price" || rule.kind === "member_price" || rule.kind === "credit_exhausted";
    priceChargedCents = "priceCents" in rule ? rule.priceCents : 0;
    if (rule.kind === "uses_credit") creditSource = rule.planName;
    // Stored as the Credit row's own id, not a display string — nothing
    // renders creditSource as text to a parent, and this is what lets
    // cancellation find the exact pack to restore a unit to.
    if (rule.kind === "uses_pack_credit") creditSource = rule.creditId;
  } else {
    // Legacy pre-Offering sessions: no Offering row to price against, so
    // fall back to the old Program-level eligibility check. These never
    // trigger real Stripe checkout — matches existing behavior.
    const eligibility = await getBookingEligibility(athleteId, sessionId);
    needsPayment = false;
    priceChargedCents = eligibility.type === "included" ? 0 : eligibility.priceCents;
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM sessions WHERE id = ${sessionId} FOR UPDATE`;

    const existing = await tx.booking.findUnique({
      where: { sessionId_athleteId: { sessionId, athleteId } },
    });
    // "not cancelled" rather than "booked" only: attended/no_show still
    // held a seat for this session, so it counts as already having one.
    if (existing && existing.status !== "cancelled") {
      return { status: "already_booked" as const };
    }

    const bookedCount = await tx.booking.count({
      where: { sessionId, status: { not: "cancelled" } },
    });

    if (bookedCount < session.capacity) {
      const paymentStatus = needsPayment ? "pending" : "none";
      let booking;
      if (existing) {
        booking = await tx.booking.update({
          where: { id: existing.id },
          data: {
            status: "booked",
            bookedByGuardianId,
            priceChargedCents,
            paymentStatus,
            creditSource,
            creditRestored: false,
            bookedAt: new Date(),
          },
        });
      } else {
        booking = await tx.booking.create({
          data: {
            sessionId,
            athleteId,
            bookedByGuardianId,
            status: "booked",
            priceChargedCents,
            paymentStatus,
            creditSource,
          },
        });
      }

      // Spend the pack credit in the same transaction as the booking — if
      // capacity had run out above, this line never runs and nothing is
      // spent. A row lock on the credit itself (not just the session)
      // prevents two concurrent bookings from both reading balance=1 and
      // both succeeding. The isPackCredit lookup below is what actually
      // disambiguates this from a membership uses_credit booking (whose
      // creditSource is a plan name, never a real Credit id) — harmless to
      // check both here rather than threading a separate flag through.
      if (creditSource && UUID_RE.test(creditSource) && priceChargedCents === 0 && needsPayment === false) {
        const isPackCredit = await tx.credit.findFirst({
          where: { id: creditSource, creditType: "dr_dish_ten_pack" },
          select: { id: true },
        });
        if (isPackCredit) {
          await tx.$executeRaw`SELECT id FROM credits WHERE id = ${creditSource} FOR UPDATE`;
          const credit = await tx.credit.findUniqueOrThrow({ where: { id: creditSource } });
          if (credit.balance < 1) {
            throw new Error("That 10-pack was just used up — refresh and try a different option.");
          }
          const balanceAfter = credit.balance - 1;
          await tx.credit.update({
            where: { id: creditSource },
            data: { balance: balanceAfter, status: balanceAfter === 0 ? "used" : "issued" },
          });
          await tx.creditLedgerEntry.create({
            data: {
              creditId: creditSource,
              delta: -1,
              balanceAfter,
              reason: "Dr. Dish self-serve booking",
              sessionId,
            },
          });
        }
      }

      return { status: "booked" as const, booking, needsPayment };
    }

    const existingWaitlist = await tx.waitlistEntry.findUnique({
      where: { sessionId_athleteId: { sessionId, athleteId } },
    });
    if (existingWaitlist?.status === "waiting") {
      return { status: "already_waitlisted" as const };
    }

    const maxPosition = await tx.waitlistEntry.aggregate({
      where: { sessionId },
      _max: { position: true },
    });
    await tx.waitlistEntry.upsert({
      where: { sessionId_athleteId: { sessionId, athleteId } },
      create: { sessionId, athleteId, position: (maxPosition._max.position ?? 0) + 1 },
      update: { status: "waiting", position: (maxPosition._max.position ?? 0) + 1 },
    });
    return { status: "waitlisted" as const };
  });

  // Stripe checkout creation happens outside the transaction — an external API
  // call must never hold the session's row lock open. If it fails, the seat
  // is released rather than left held forever on a booking nobody can pay for.
  if (result.status === "booked" && result.needsPayment) {
    try {
      const checkoutUrl = await createBookingCheckout(result.booking.id, athleteId, bookedByGuardianId, priceChargedCents!);
      return { status: "booked" as const, checkoutUrl };
    } catch (err) {
      await cancelBookingById(result.booking.id);
      throw err;
    }
  }

  return result;
}

async function createBookingCheckout(
  bookingId: string,
  athleteId: string,
  guardianId: string | null,
  priceCents: number
): Promise<string> {
  if (!guardianId) {
    throw new Error("A paid booking needs a guardian on file to check out.");
  }
  const guardian = await prisma.guardian.findUniqueOrThrow({ where: { id: guardianId } });

  let customerId = guardian.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: guardian.email ?? undefined,
      name: guardian.name,
      metadata: { guardianId: guardian.id },
    });
    customerId = customer.id;
    await prisma.guardian.update({ where: { id: guardian.id }, data: { stripeCustomerId: customerId } });
  }

  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { session: { include: { offering: true, program: true } }, athlete: true },
  });
  const offering = booking.session.offering;

  const origin = await getOrigin();
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: priceCents,
          product: offering?.stripeProductId ?? undefined,
          product_data: offering?.stripeProductId
            ? undefined
            : { name: booking.session.program.name },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/my-courts/schedule?checkout=success`,
    cancel_url: `${origin}/my-courts/explore?checkout=cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_EXPIRY_MINUTES * 60,
    metadata: { bookingId, athleteId, guardianId },
    payment_intent_data: {
      description: `${booking.session.program.name} — ${booking.athlete.firstName} ${booking.athlete.lastName}`,
      metadata: { bookingId, athleteId, guardianId },
    },
  });

  if (!checkoutSession.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      stripeCheckoutSessionId: checkoutSession.id,
      checkoutExpiresAt: new Date((checkoutSession.expires_at ?? Math.floor(Date.now() / 1000) + CHECKOUT_EXPIRY_MINUTES * 60) * 1000),
    },
  });

  return checkoutSession.url;
}

// Re-opens Checkout for a booking whose original session expired (or was
// simply abandoned) without the family paying — the seat is still held
// (status stays "booked"), so this only needs a fresh Checkout Session
// against the same booking, never a new booking row (bookAthleteIntoSession
// isn't reusable here: sessionId+athleteId is unique, so calling it again
// for the same seat would just hit that constraint).
export async function resumeBookingCheckout(bookingId: string): Promise<string> {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (booking.paymentStatus !== "pending" || booking.status === "cancelled") {
    throw new Error("This booking no longer has a payment waiting.");
  }
  if (!booking.priceChargedCents) {
    throw new Error("This booking has no price to charge.");
  }
  return createBookingCheckout(bookingId, booking.athleteId, booking.bookedByGuardianId, booking.priceChargedCents);
}

/// Cancels any booking still `pending` payment past its Checkout Session's
/// expiry — a family that opens Checkout and abandons it must not hold a seat
/// forever. Mirrors expireStaleOffers' role for the waitlist.
export async function expireStalePendingBookings() {
  const stale = await prisma.booking.findMany({
    where: { paymentStatus: "pending", checkoutExpiresAt: { lt: new Date() } },
    select: { id: true },
  });
  for (const b of stale) {
    await cancelBookingById(b.id);
  }
  return stale.length;
}

// Real money's real policy: a drop-in class (registrationMode "session" —
// Group Training, Dr. Dish) refunds and restores a Training Plan credit if
// cancelled at least this many hours before the session starts; inside that
// window, neither happens. Camps and League never refund at all, regardless
// of timing — they simply aren't "session" registrationMode, so the checks
// below never apply to them.
const REFUND_CUTOFF_HOURS = 12;

// Cancels a booking. If a seat frees up, the next waiting family is OFFERED it
// — never booked and charged automatically. Refunds/credit restoration (see
// REFUND_CUTOFF_HOURS above) happen here too, since they're both consequences
// of the same cancellation.
//
// This used to auto-convert the oldest waitlist entry straight into a paid
// booking. That silently enrolled a child and charged a card because somebody
// else dropped out, which is not a decision this system gets to make on a
// family's behalf. Promotion is now an explicit, expiring offer; see
// lib/programs/waitlist.ts.
export async function cancelBookingById(bookingId: string) {
  const found = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { session: { include: { offering: true } } },
  });
  if (found.status !== "booked") return;

  const hoursUntilStart = (found.session.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
  const inTime = hoursUntilStart >= REFUND_CUTOFF_HOURS;
  const isDropIn = found.session.offering?.registrationMode === "session";

  const shouldRefund =
    isDropIn && inTime && found.paymentStatus === "paid" && !!found.priceChargedCents && found.priceChargedCents > 0;
  const shouldRestoreCredit = isDropIn && inTime && !!found.creditSource && !found.creditRestored;

  const booking = await prisma.$transaction(async (tx) => {
    const current = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (current.status !== "booked") return null;

    await tx.$executeRaw`SELECT id FROM sessions WHERE id = ${found.sessionId} FOR UPDATE`;
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: "cancelled",
        ...(shouldRestoreCredit ? { creditRestored: true } : {}),
      },
    });

    // A membership entitlement's "remaining" count is derived (see
    // uses_credit in pricing.ts) — creditRestored:true above is the whole
    // restoration. A 10-pack's balance is a real stored counter, so it needs
    // an actual increment back, same lock discipline as spending it.
    if (shouldRestoreCredit && found.creditSource && UUID_RE.test(found.creditSource)) {
      await tx.$executeRaw`SELECT id FROM credits WHERE id = ${found.creditSource} FOR UPDATE`;
      const pack = await tx.credit.findFirst({
        where: { id: found.creditSource, creditType: "dr_dish_ten_pack" },
      });
      if (pack) {
        const balanceAfter = pack.balance + 1;
        await tx.credit.update({
          where: { id: pack.id },
          data: { balance: balanceAfter, status: "issued" },
        });
        await tx.creditLedgerEntry.create({
          data: {
            creditId: pack.id,
            delta: 1,
            balanceAfter,
            reason: "Cancelled in time — pack credit restored",
            sessionId: found.sessionId,
          },
        });
      }
    }

    return found;
  });

  if (!booking) return;

  // Outside the transaction: an external Stripe call must never hold the
  // session's row lock open, and offering a spot takes its own lock — a
  // failure in either must not roll back the cancellation the family already
  // completed.
  if (shouldRefund && found.stripeCheckoutSessionId) {
    try {
      const checkoutSession = await stripe.checkout.sessions.retrieve(found.stripeCheckoutSessionId);
      const paymentIntentId =
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : checkoutSession.payment_intent?.id;
      if (paymentIntentId) {
        await stripe.refunds.create({ payment_intent: paymentIntentId });
        await prisma.booking.update({ where: { id: bookingId }, data: { paymentStatus: "refunded" } });
      }
    } catch (err) {
      // The seat is already freed regardless — a refund failure here means an
      // admin needs to issue it manually in Stripe, not that the cancellation
      // itself failed.
      console.error("Refund failed for booking", bookingId, err);
    }
  }

  await offerNextSpot(booking.sessionId, null);
}

export async function cancelWaitlistEntryById(waitlistEntryId: string) {
  await prisma.waitlistEntry.delete({ where: { id: waitlistEntryId } });
}
