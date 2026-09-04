-- AlterEnum
ALTER TYPE "MembershipStatus" ADD VALUE 'past_due';

-- AlterTable
ALTER TABLE "athlete_memberships" ADD COLUMN     "stripe_subscription_id" TEXT;

-- AlterTable
ALTER TABLE "guardians" ADD COLUMN     "stripe_customer_id" TEXT;

-- AlterTable
ALTER TABLE "membership_plans" ADD COLUMN     "stripe_price_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "athlete_memberships_stripe_subscription_id_key" ON "athlete_memberships"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "guardians_stripe_customer_id_key" ON "guardians"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_plans_stripe_price_id_key" ON "membership_plans"("stripe_price_id");

