// Rename the "Weekly Membership" plan to "Flex 4 Membership" (2026-11-07).
// Members kept confusing "Weekly" with weekly billing; it's 4 sessions per
// monthly billing cycle. Renames the plan row, the Stripe product, and the
// plan name recorded on past bookings (Booking.creditSource), which is what the
// session allowance counts by — so nobody's "sessions left" changes.
//
//   npx tsx scripts/rename-weekly-to-flex4.ts            preview
//   npx tsx scripts/rename-weekly-to-flex4.ts --apply    apply
import "dotenv/config";
import Stripe from "stripe";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const APPLY = process.argv.includes("--apply");
const OLD = "Weekly Membership", NEW = "Flex 4 Membership";

async function main() {
  const plan = await prisma.membershipPlan.findFirst({ where: { name: { in: [OLD, NEW] } } });
  if (!plan) throw new Error("Plan not found.");
  const bookings = await prisma.booking.count({ where: { creditSource: OLD } });
  const price = plan.stripePriceId ? await stripe.prices.retrieve(plan.stripePriceId, { expand: ["product"] }) : null;
  const product = price?.product as Stripe.Product | undefined;
  console.log({ planName: plan.name, description: plan.description, bookingsToRelabel: bookings, stripeProduct: product && { id: product.id, name: product.name, description: product.description }, priceNickname: price?.nickname });
  if (!APPLY) return;

  await prisma.$transaction([
    prisma.membershipPlan.update({ where: { id: plan.id }, data: { name: NEW } }),
    prisma.booking.updateMany({ where: { creditSource: OLD }, data: { creditSource: NEW } }),
  ]);
  if (product && product.name !== NEW) await stripe.products.update(product.id, { name: NEW });
  if (price?.nickname && /weekly/i.test(price.nickname)) await stripe.prices.update(price.id, { nickname: price.nickname.replace(/weekly/i, "Flex 4") });

  const after = await prisma.membershipPlan.findUniqueOrThrow({ where: { id: plan.id }, select: { name: true } });
  const left = await prisma.booking.count({ where: { creditSource: OLD } });
  const p2 = product ? await stripe.products.retrieve(product.id) : null;
  console.log({ planName: after.name, bookingsStillOld: left, stripeProductName: p2?.name });
}
main().finally(() => prisma.$disconnect());
