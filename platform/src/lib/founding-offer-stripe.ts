import "server-only";
import { stripe } from "@/lib/stripe";
import { FOUNDING_OFFER } from "@/lib/founding-offer";

/// Returns the founding coupon id if it can still be redeemed, creating it in
/// Stripe the first time it's needed. Returns null once all spots are used or the
/// window has closed, so checkout falls back to the normal price instead of
/// failing.
export async function getFoundingCouponId(regularPriceCents: number): Promise<string | null> {
  const amountOff = regularPriceCents - FOUNDING_OFFER.rateCents;
  if (amountOff <= 0) return null;
  try {
    const existing = await stripe.coupons.retrieve(FOUNDING_OFFER.couponId);
    return existing.valid ? existing.id : null;
  } catch {
    const created = await stripe.coupons.create({
      id: FOUNDING_OFFER.couponId,
      name: "Founding Rate — $185/mo through December",
      amount_off: amountOff,
      currency: "usd",
      duration: "repeating",
      duration_in_months: FOUNDING_OFFER.months,
      max_redemptions: FOUNDING_OFFER.maxRedemptions,
      redeem_by: Math.floor(FOUNDING_OFFER.closesAt.getTime() / 1000),
    });
    return created.valid ? created.id : null;
  }
}
