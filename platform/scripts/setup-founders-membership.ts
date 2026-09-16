import "dotenv/config";
import Stripe from "stripe";
import { prisma } from "../src/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const FOUNDERS_PRICE_CENTS = 18500;

// Copied verbatim from the real "Unlimited Membership" plan's entitlement
// rows (confirmed by direct query before writing this script) — Founders
// mirrors Unlimited's benefits exactly, at a loyalty discount below its
// $200/mo. programId: null on the class_credit row means the unlimited
// Group Training allowance is shared across the whole pool, same as
// Unlimited's.
const UNLIMITED_ENTITLEMENTS: { benefitType: "member_pricing" | "class_credit"; programId: string | null }[] = [
  { benefitType: "member_pricing", programId: "ecebfbf4-e34f-4a02-ad5c-7a6404d0b3b4" }, // Private Training
  { benefitType: "member_pricing", programId: "72ea7d7c-cdb0-4137-a22d-74babbb35e05" }, // Dr. Dish
  { benefitType: "member_pricing", programId: "86286449-bb2f-4b7d-80f0-bbe6f1edda6e" }, // Camps
  { benefitType: "class_credit", programId: null }, // Unlimited Group Training
];

async function main() {
  let plan = await prisma.membershipPlan.findFirst({ where: { name: "Founders Membership" } });

  if (plan?.stripePriceId) {
    console.log("Founders Membership already fully set up:", plan.id, plan.stripePriceId);
  } else {
    const product = await stripe.products.create({
      name: "Founders Membership",
      metadata: { courts_membership_plan: "founders" },
    });
    const price = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: FOUNDERS_PRICE_CENTS,
      recurring: { interval: "month" },
    });

    plan = plan
      ? await prisma.membershipPlan.update({ where: { id: plan.id }, data: { stripePriceId: price.id } })
      : await prisma.membershipPlan.create({
          data: {
            name: "Founders Membership",
            priceCents: FOUNDERS_PRICE_CENTS,
            billingInterval: "monthly",
            description:
              "For NextGen families making the move — the same access as Unlimited, at a founders' rate.",
            stripePriceId: price.id,
            active: true,
          },
        });

    console.log("Created Stripe Product:", product.id);
    console.log("Created Stripe Price:", price.id);
    console.log("Plan row:", plan.id);
    console.log(`Set NEXTGEN_LEGACY_STRIPE_PRODUCT_ID=${product.id} in env — startNextGenLegacyCheckout needs it.`);

    const existingEntitlements = await prisma.planEntitlement.findMany({ where: { membershipPlanId: plan.id } });
    if (existingEntitlements.length === 0) {
      await prisma.planEntitlement.createMany({
        data: UNLIMITED_ENTITLEMENTS.map((e) => ({
          membershipPlanId: plan!.id,
          benefitType: e.benefitType,
          programId: e.programId,
          quantityPerPeriod: null,
        })),
      });
      console.log(`Created ${UNLIMITED_ENTITLEMENTS.length} entitlement rows mirroring Unlimited Membership.`);
    }
  }

  const legacyPlan = await prisma.membershipPlan.findFirst({ where: { name: "NextGen Legacy Rate" } });
  if (!legacyPlan) {
    const created = await prisma.membershipPlan.create({
      data: {
        name: "NextGen Legacy Rate",
        priceCents: 0,
        billingInterval: "monthly",
        active: false,
        stripePriceId: null,
        description:
          "Placeholder FK target for ad-hoc-priced Current NextGen transfer subscriptions. The real amount comes from Guardian.legacyRateCents via price_data at checkout — this row's priceCents is never charged or displayed.",
      },
    });
    console.log("Created placeholder plan:", created.id);
  } else {
    console.log("Placeholder plan already exists:", legacyPlan.id);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
