import "dotenv/config";
import Stripe from "stripe";
import { prisma } from "../src/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const NEW_PRICE_CENTS = 16500;

async function main() {
  const plan = await prisma.membershipPlan.findFirstOrThrow({
    where: { name: "Founders Membership" },
  });

  if (plan.priceCents === NEW_PRICE_CENTS) {
    console.log("Already at $165 — nothing to do.", plan.id, plan.stripePriceId);
    return;
  }

  const oldPriceId = plan.stripePriceId;
  if (!oldPriceId) throw new Error("Founders Membership has no stripePriceId to migrate from.");

  const oldPrice = await stripe.prices.retrieve(oldPriceId);
  const productId = typeof oldPrice.product === "string" ? oldPrice.product : oldPrice.product.id;

  // Real, live check — never retire a price with real subscribers without a
  // human looking first.
  const activeSubs = await stripe.subscriptions.list({ price: oldPriceId, limit: 100 });
  if (activeSubs.data.length > 0) {
    console.error(
      `REFUSING to retire ${oldPriceId} — ${activeSubs.data.length} real subscription(s) still reference it:`,
      activeSubs.data.map((s) => s.id)
    );
    process.exitCode = 1;
    return;
  }

  const newPrice = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: NEW_PRICE_CENTS,
    recurring: { interval: "month" },
  });

  await stripe.prices.update(oldPriceId, { active: false });

  await prisma.membershipPlan.update({
    where: { id: plan.id },
    data: { priceCents: NEW_PRICE_CENTS, stripePriceId: newPrice.id },
  });

  console.log("Retired old price:", oldPriceId);
  console.log("New $165 price:", newPrice.id);
  console.log("Plan updated:", plan.id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
