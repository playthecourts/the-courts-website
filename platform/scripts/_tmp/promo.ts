import "dotenv/config";
import Stripe from "stripe";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const APPLY = process.argv.includes("--apply");
(async () => {
  const offs = await p.offering.findMany({
    where: { program: { programType: "group_training" }, status: "published" },
    select: { name: true, seasonLabel: true, priceCents: true, stripeProductId: true },
  });
  for (const o of offs) console.log(`${o.name} ${o.seasonLabel ?? ""} $${(o.priceCents ?? 0) / 100} product=${o.stripeProductId}`);
  const existing = await stripe.promotionCodes.list({ code: "NODAYSOFF", limit: 5 });
  console.log("existing NODAYSOFF codes:", existing.data.map((c) => ({ id: c.id, active: c.active })));
  const products = [...new Set(offs.filter((o) => o.priceCents === 4000).map((o) => o.stripeProductId).filter(Boolean))] as string[];
  console.log("products to restrict to:", products.length, "offerings without product:", offs.filter((o) => !o.stripeProductId).map((o) => o.name));
  if (!APPLY) return p.$disconnect();
  if (existing.data.some((c) => c.active)) throw new Error("NODAYSOFF already exists.");
  const coupon = await stripe.coupons.create({
    amount_off: 2000, currency: "usd", duration: "once", name: "NoDaysOff – $20 off drop-in",
    applies_to: { products },
    metadata: { purpose: "$20 off a drop-in group training class", createdFor: "Melissa 2026-11-07" },
  });
  const promo = await stripe.promotionCodes.create({ promotion: { type: "coupon", coupon: coupon.id }, code: "NODAYSOFF" } as any);
  console.log({ coupon: coupon.id, promo: promo.id, code: promo.code, active: promo.active });
  await p.$disconnect();
})();
