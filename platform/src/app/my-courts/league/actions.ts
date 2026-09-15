"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getUnsignedRequiredWaivers } from "@/lib/waivers";
import { stripe } from "@/lib/stripe";

async function getOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

/// Registers an athlete for the real Fall 2026 Basketball League and sends
/// the guardian to Stripe to pay the $375. Team placement is a separate,
/// staff-driven step after evaluation — this only creates the registration
/// record and collects payment, matching what the site already tells
/// families ("our coaching team will follow up directly about player
/// placement").
export async function startLeagueRegistration(athleteId: string) {
  const guardian = await getCurrentGuardian();
  const athlete = guardian.families
    .flatMap((fg) => fg.family.athletes)
    .find((a) => a.id === athleteId);
  if (!athlete) {
    throw new Error("Not authorized to act on this athlete.");
  }

  // A crashed page (thrown uncaught) is worse than a redirect — send the
  // guardian to sign what's missing instead of letting startLeagueRegistration
  // blow up the whole request the way bookSession's assertWaiversSigned
  // would too (same underlying gap, not fixed here).
  const unsigned = await getUnsignedRequiredWaivers(guardian.id, athleteId);
  if (unsigned.length > 0) {
    redirect("/my-courts/waivers?required=league&back=%2Fmy-courts%2Fleague");
  }

  // League athletes must carry an active Courts membership (Weekly or
  // higher — and Weekly is the floor, so any active plan qualifies) for the
  // season, per the FAQ's own stated policy. Catching this before payment
  // means a family never pays $375 only to learn afterward they're not
  // eligible yet.
  const activeMembership = await prisma.athleteMembership.findFirst({
    where: { athleteId, status: "active" },
  });
  if (!activeMembership) {
    redirect(`/my-courts/memberships?required=league&athlete=${athleteId}`);
  }

  const offering = await prisma.offering.findFirstOrThrow({
    where: { name: "Fall 2026 Basketball League" },
  });
  if (!offering.stripePriceId) {
    throw new Error("League registration isn't connected to Stripe yet.");
  }

  // Upsert on [offeringId, athleteId]: re-registering after an abandoned
  // checkout updates the same row rather than creating a duplicate.
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

  const origin = await getOrigin();
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: offering.stripePriceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${origin}/my-courts/league?checkout=success`,
    cancel_url: `${origin}/my-courts/league?checkout=cancelled`,
    metadata: { registrationId: registration.id, athleteId, guardianId: guardian.id },
    payment_intent_data: {
      description: `Fall League Registration — ${athlete.firstName} ${athlete.lastName}`,
      metadata: { registrationId: registration.id, athleteId, guardianId: guardian.id },
    },
  });

  if (!checkoutSession.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  await prisma.registration.update({
    where: { id: registration.id },
    data: { stripeCheckoutSessionId: checkoutSession.id },
  });

  redirect(checkoutSession.url);
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
