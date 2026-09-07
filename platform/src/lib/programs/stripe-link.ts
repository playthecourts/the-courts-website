import "server-only";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Stripe linkage for an Offering.
//
// Stripe owns the payment objects. This module creates or attaches a Product
// and Price and stores the ids — it does not model prices itself, does not
// cache Stripe state, and never touches card data.
//
// Tax is handled explicitly and never guessed. Coach-led training, league
// participation, open gym, court rental and merchandise can each be taxed
// differently; inferring a tax code from marketing copy is how a business ends
// up remitting the wrong amount. A paid offering with no tax code is flagged
// TAX SETUP REQUIRED and cannot be published live.
// ---------------------------------------------------------------------------

export type StripeLinkResult =
  | { ok: true; productId: string; priceId: string; memberPriceId: string | null }
  | { ok: false; error: string };

/// Creates a Stripe Product + Price for an offering, or reuses what's linked.
/// Prices are immutable in Stripe, so a changed amount creates a NEW Price and
/// re-points the offering — the old Price stays valid for anyone mid-checkout.
export async function syncOfferingToStripe(offeringId: string): Promise<StripeLinkResult> {
  const offering = await prisma.offering.findUniqueOrThrow({
    where: { id: offeringId },
    select: {
      id: true,
      name: true,
      seasonLabel: true,
      shortDescription: true,
      priceCents: true,
      memberPriceCents: true,
      pricingModel: true,
      stripeProductId: true,
      stripePriceId: true,
      stripeMemberPriceId: true,
      stripeTaxCode: true,
      taxBehavior: true,
      program: { select: { name: true, programType: true, sport: true } },
    },
  });

  if (offering.pricingModel === "free") {
    return { ok: false, error: "This offering is free — no Stripe setup is needed." };
  }
  if (offering.priceCents === null || offering.priceCents <= 0) {
    return { ok: false, error: "Set a price before connecting Stripe." };
  }
  if (!offering.stripeTaxCode) {
    return {
      ok: false,
      error:
        "TAX SETUP REQUIRED — choose a Stripe tax code for this offering. It is deliberately not inferred from the program type.",
    };
  }

  try {
    // --- Product ---
    let productId = offering.stripeProductId;
    const productName = [offering.name, offering.seasonLabel].filter(Boolean).join(" · ");
    if (productId) {
      await stripe.products.update(productId, {
        name: productName,
        description: offering.shortDescription ?? undefined,
        tax_code: offering.stripeTaxCode,
      });
    } else {
      const product = await stripe.products.create({
        name: productName,
        description: offering.shortDescription ?? undefined,
        tax_code: offering.stripeTaxCode,
        metadata: {
          courts_offering_id: offering.id,
          courts_program_type: offering.program.programType,
          courts_sport: offering.program.sport ?? "",
        },
      });
      productId = product.id;
    }

    // --- Prices. Immutable in Stripe: only create when the amount changed. ---
    const taxBehavior =
      offering.taxBehavior === "unspecified" ? undefined : offering.taxBehavior;

    const priceId = await ensurePrice(
      productId,
      offering.stripePriceId,
      offering.priceCents,
      taxBehavior,
      { courts_offering_id: offering.id, courts_price_kind: "standard" }
    );

    const memberPriceId =
      offering.memberPriceCents !== null && offering.memberPriceCents > 0
        ? await ensurePrice(
            productId,
            offering.stripeMemberPriceId,
            offering.memberPriceCents,
            taxBehavior,
            { courts_offering_id: offering.id, courts_price_kind: "member" }
          )
        : null;

    await prisma.offering.update({
      where: { id: offering.id },
      data: { stripeProductId: productId, stripePriceId: priceId, stripeMemberPriceId: memberPriceId },
    });

    return { ok: true, productId, priceId, memberPriceId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Stripe error";
    return { ok: false, error: `Stripe: ${message}` };
  }
}

async function ensurePrice(
  productId: string,
  existingPriceId: string | null,
  amountCents: number,
  taxBehavior: "inclusive" | "exclusive" | undefined,
  metadata: Record<string, string>
): Promise<string> {
  if (existingPriceId) {
    const current = await stripe.prices.retrieve(existingPriceId).catch(() => null);
    if (current && current.active && current.unit_amount === amountCents) return current.id;
    // Amount changed: archive the old Price so it stops appearing in Stripe's
    // UI, but leave it valid for any checkout already in flight.
    if (current && current.active) {
      await stripe.prices.update(current.id, { active: false }).catch(() => undefined);
    }
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: amountCents,
    ...(taxBehavior ? { tax_behavior: taxBehavior } : {}),
    metadata,
  });
  return price.id;
}
