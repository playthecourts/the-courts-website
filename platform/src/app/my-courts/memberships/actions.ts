"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentGuardian } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

async function getOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function startMembershipCheckout(athleteId: string, membershipPlanId: string) {
  const guardian = await getCurrentGuardian();

  const ownsAthlete = guardian.families.some((fg) =>
    fg.family.athletes.some((a) => a.id === athleteId)
  );
  if (!ownsAthlete) {
    throw new Error("Not authorized to act on this athlete.");
  }

  const plan = await prisma.membershipPlan.findUniqueOrThrow({
    where: { id: membershipPlanId },
  });
  if (!plan.stripePriceId) {
    throw new Error("This plan isn't available for online checkout yet.");
  }

  let customerId = guardian.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: guardian.email,
      name: guardian.name,
      metadata: { guardianId: guardian.id },
    });
    customerId = customer.id;
    await prisma.guardian.update({
      where: { id: guardian.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const origin = await getOrigin();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${origin}/my-courts/memberships?checkout=success`,
    cancel_url: `${origin}/my-courts/memberships?checkout=cancelled`,
    metadata: { athleteId, membershipPlanId, guardianId: guardian.id },
    subscription_data: {
      metadata: { athleteId, membershipPlanId, guardianId: guardian.id },
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  redirect(session.url);
}
