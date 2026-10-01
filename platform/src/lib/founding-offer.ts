// Opening-day founding rate: Unlimited at $185/mo (instead of $200) for the
// October, November and December charges, for families who sign up on
// Oct 1, 2026 (Central) and are NOT NextGen transfers. Advertised as the
// first 10; capped at 20 in Stripe. From Jan 1, 2027 they renew at the
// normal price.
//
// Implemented as a Stripe coupon ($15 off, 3 monthly invoices, 20 uses,
// redeemable until midnight Central) so Stripe enforces the window and the
// cap; the app just decides who is offered it.

export const FOUNDING_OFFER = {
  planName: "Unlimited Membership",
  rateCents: 18500,
  couponId: "FOUNDING185-OCT1-2026-CAP20",
  // Oct 1, 2026 12:00 AM → Oct 2, 2026 12:00 AM Central (CDT, UTC-5)
  opensAt: new Date("2026-10-01T05:00:00.000Z"),
  closesAt: new Date("2026-10-02T05:00:00.000Z"),
  months: 3,
  maxRedemptions: 20,
} as const;

export function isFoundingOfferOpen(now = new Date()) {
  return now >= FOUNDING_OFFER.opensAt && now < FOUNDING_OFFER.closesAt;
}

/// Who sees and gets the founding rate: not a NextGen transfer (they have
/// their own legacy/Formers pricing), on the Unlimited plan, today only.
export function isFoundingOfferEligible(
  guardian: { nextGenStatus: string | null },
  planName: string,
  now = new Date()
) {
  return isFoundingOfferOpen(now) && guardian.nextGenStatus == null && planName === FOUNDING_OFFER.planName;
}
