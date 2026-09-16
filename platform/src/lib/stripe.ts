import "server-only";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/// Every checkout path (League, membership, session booking, the Billing
/// Portal) needs a real Stripe Customer for the guardian. A guardian's
/// `stripeCustomerId`, once set, was trusted blindly — but a live guardian
/// can end up with an id from a customer that no longer exists (most likely:
/// created back when the app pointed at Stripe test mode, then never
/// re-created once switched to live). Stripe rejects that id outright
/// ("No such customer"), which crashed League registration in production
/// for a real family. This re-verifies the stored id against Stripe itself
/// before trusting it, self-healing by creating a fresh customer (and
/// persisting it) whenever the stored one is missing or was deleted.
export async function getOrCreateStripeCustomer(guardian: {
  id: string;
  email: string | null;
  name: string;
  stripeCustomerId: string | null;
}): Promise<string> {
  if (guardian.stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(guardian.stripeCustomerId);
      if (!existing.deleted) return guardian.stripeCustomerId;
    } catch (err) {
      const isMissing =
        err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing";
      if (!isMissing) throw err;
      // Falls through to create a replacement below.
    }
  }

  const customer = await stripe.customers.create({
    email: guardian.email ?? undefined,
    name: guardian.name,
    metadata: { guardianId: guardian.id },
  });
  await prisma.guardian.update({ where: { id: guardian.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}
