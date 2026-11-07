import "server-only";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// Stripe promotion codes a family may redeem only ONCE. Stripe has no
// per-customer limit for a shared code (only a global cap or "first-time
// customers only"), and one family can have several Stripe customers (one per
// guardian), so the limit is enforced here: before opening a drop-in checkout,
// look for a completed checkout by any guardian in the family that used one of
// these codes, and if found, open checkout without the promotion-code field.
//
// Side effect, accepted when this was built: a family that has used one of
// these codes can't enter any other code at drop-in checkout either.
export const ONCE_PER_FAMILY_CODES = ["NODAYSOFF"];

let promoIdCache: { at: number; ids: string[] } | null = null;

async function oncePerFamilyPromoIds(): Promise<string[]> {
  if (promoIdCache && Date.now() - promoIdCache.at < 10 * 60_000) return promoIdCache.ids;
  const ids: string[] = [];
  for (const code of ONCE_PER_FAMILY_CODES) {
    const list = await stripe.promotionCodes.list({ code, limit: 100 });
    ids.push(...list.data.map((p) => p.id));
  }
  promoIdCache = { at: Date.now(), ids };
  return ids;
}

function promoIdOf(p: string | Stripe.PromotionCode | null | undefined): string | null {
  if (!p) return null;
  return typeof p === "string" ? p : p.id;
}

function sessionUsedPromo(s: Stripe.Checkout.Session, ids: string[]): boolean {
  if (s.discounts?.some((d) => ids.includes(promoIdOf(d.promotion_code) ?? ""))) return true;
  const breakdown = s.total_details?.breakdown?.discounts ?? [];
  return breakdown.some((d) => ids.includes(promoIdOf(d.discount.promotion_code) ?? ""));
}

/// True when anyone in this athlete's family has already completed a checkout
/// using a once-per-family code. Fails open (returns false) if Stripe can't be
/// reached, so a lookup hiccup never blocks a family from paying.
export async function familyHasUsedOncePerFamilyPromo(athleteId: string): Promise<boolean> {
  try {
    const ids = await oncePerFamilyPromoIds();
    if (ids.length === 0) return false;
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { family: { select: { guardians: { select: { guardian: { select: { stripeCustomerId: true } } } } } } },
    });
    const customers = [
      ...new Set((athlete?.family.guardians ?? []).map((g) => g.guardian.stripeCustomerId).filter((c): c is string => !!c)),
    ];
    for (const customer of customers) {
      for await (const s of stripe.checkout.sessions.list({
        customer,
        status: "complete",
        limit: 100,
        expand: ["data.total_details.breakdown"],
      })) {
        if (sessionUsedPromo(s, ids)) return true;
      }
    }
    return false;
  } catch (err) {
    console.error("familyHasUsedOncePerFamilyPromo failed; allowing promotion codes", athleteId, err);
    return false;
  }
}
