-- AlterEnum
ALTER TYPE "NextGenVerification" ADD VALUE 'admin_approved';

-- AlterTable
ALTER TABLE "athlete_memberships" ADD COLUMN     "linked_membership_id" TEXT;

-- AlterTable
ALTER TABLE "guardians" ADD COLUMN     "next_gen_notes" TEXT;

-- AlterTable
ALTER TABLE "membership_plans" ADD COLUMN     "entitlements_from_plan_id" TEXT;

-- CreateTable
CREATE TABLE "next_gen_records" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "athlete_name" TEXT,
    "athlete_dob" DATE,
    "legacy_rate_cents" INTEGER,
    "matched_guardian_id" TEXT,
    "matched_at" TIMESTAMP(3),
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "next_gen_records_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "next_gen_records" ADD CONSTRAINT "next_gen_records_matched_guardian_id_fkey" FOREIGN KEY ("matched_guardian_id") REFERENCES "guardians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_plans" ADD CONSTRAINT "membership_plans_entitlements_from_plan_id_fkey" FOREIGN KEY ("entitlements_from_plan_id") REFERENCES "membership_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_memberships" ADD CONSTRAINT "athlete_memberships_linked_membership_id_fkey" FOREIGN KEY ("linked_membership_id") REFERENCES "athlete_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
