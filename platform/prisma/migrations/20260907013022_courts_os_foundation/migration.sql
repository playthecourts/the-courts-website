-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('draft', 'published', 'closed', 'completed', 'cancelled', 'archived');

-- CreateEnum
CREATE TYPE "LeagueStage" AS ENUM ('interest', 'evaluation', 'evaluation_complete', 'registration', 'team_placement', 'season', 'tournament', 'complete');

-- CreateEnum
CREATE TYPE "CreditStatus" AS ENUM ('issued', 'used', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('started', 'incomplete', 'registered', 'waitlisted', 'cancelled', 'admin_review');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('none', 'due', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('website', 'parent_referral', 'coach_referral', 'walk_in', 'social', 'nextgen_rollover', 'camp', 'league_evaluation', 'event', 'rental', 'other');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('new', 'contacted', 'trial', 'attended', 'follow_up', 'converted', 'not_now');

-- CreateEnum
CREATE TYPE "PromoStatus" AS ENUM ('issued', 'used', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "FacilityBlockReason" AS ENUM ('maintenance', 'private_event', 'holiday', 'repair', 'owner_block', 'other');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('open', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "ContentSlot" AS ENUM ('announcement_bar', 'homepage_featured_program', 'featured_camp', 'featured_league', 'featured_event', 'emergency_closure', 'this_week_at_the_courts', 'parent_app_announcement', 'coach_app_announcement');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StaffRole" ADD VALUE 'owner';
ALTER TYPE "StaffRole" ADD VALUE 'marketing';
ALTER TYPE "StaffRole" ADD VALUE 'finance_viewer';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "registration_id" TEXT;

-- AlterTable
ALTER TABLE "credits" ADD COLUMN     "eligible_program_id" TEXT,
ADD COLUMN     "redeemed_at" TIMESTAMP(3),
ADD COLUMN     "status" "CreditStatus" NOT NULL DEFAULT 'issued',
ADD COLUMN     "value_cents" INTEGER;

-- AlterTable
ALTER TABLE "programs" ADD COLUMN     "age_max" INTEGER,
ADD COLUMN     "age_min" INTEGER,
ADD COLUMN     "archived_at" TIMESTAMP(3),
ADD COLUMN     "cancellation_policy" TEXT,
ADD COLUMN     "default_capacity" INTEGER,
ADD COLUMN     "duplicated_from_id" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "grade_max" INTEGER,
ADD COLUMN     "grade_min" INTEGER,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "internal_name" TEXT,
ADD COLUMN     "league_stage" "LeagueStage",
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "registration_closes_at" TIMESTAMP(3),
ADD COLUMN     "registration_opens_at" TIMESTAMP(3),
ADD COLUMN     "season_label" TEXT,
ADD COLUMN     "skill_level" TEXT,
ADD COLUMN     "status" "ProgramStatus" NOT NULL DEFAULT 'draft',
ADD COLUMN     "stripe_member_price_id" TEXT,
ADD COLUMN     "stripe_price_id" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "visible_coach_app" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "visible_parent_app" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "visible_website" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "waitlist_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sport" TEXT;

-- CreateTable
CREATE TABLE "credit_ledger_entries" (
    "id" TEXT NOT NULL,
    "credit_id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "staff_user_id" TEXT,
    "session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'started',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'none',
    "amount_cents" INTEGER,
    "stripe_checkout_session_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "promo_code_id" TEXT,
    "credit_applied_cents" INTEGER,
    "form_responses" JSONB,
    "waivers_complete" BOOLEAN NOT NULL DEFAULT false,
    "created_by_staff_id" TEXT,
    "admin_note" TEXT,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'other',
    "stage" "LeadStage" NOT NULL DEFAULT 'new',
    "sport" TEXT,
    "interest" TEXT,
    "notes" TEXT,
    "family_id" TEXT,
    "owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "converted_at" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "staff_user_id" TEXT,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount_off_cents" INTEGER,
    "percent_off" INTEGER,
    "status" "PromoStatus" NOT NULL DEFAULT 'issued',
    "eligible_program_id" TEXT,
    "source" TEXT,
    "max_redemptions" INTEGER,
    "times_redeemed" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "stripe_promotion_code_id" TEXT,
    "stripe_coupon_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_blocks" (
    "id" TEXT NOT NULL,
    "resource_id" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "reason" "FacilityBlockReason" NOT NULL,
    "note" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'open',
    "due_date" DATE,
    "assigned_to_id" TEXT,
    "created_by_id" TEXT,
    "family_id" TEXT,
    "program_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_blocks" (
    "id" TEXT NOT NULL,
    "slot" "ContentSlot" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "headline" TEXT,
    "body" TEXT,
    "link_label" TEXT,
    "link_url" TEXT,
    "program_id" TEXT,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_waivers" (
    "program_id" TEXT NOT NULL,
    "waiver_id" TEXT NOT NULL,

    CONSTRAINT "program_waivers_pkey" PRIMARY KEY ("program_id","waiver_id")
);

-- CreateIndex
CREATE INDEX "credit_ledger_entries_credit_id_created_at_idx" ON "credit_ledger_entries"("credit_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_stripe_checkout_session_id_key" ON "registrations"("stripe_checkout_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_stripe_payment_intent_id_key" ON "registrations"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "registrations_status_idx" ON "registrations"("status");

-- CreateIndex
CREATE INDEX "registrations_payment_status_idx" ON "registrations"("payment_status");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_program_id_athlete_id_key" ON "registrations"("program_id", "athlete_id");

-- CreateIndex
CREATE INDEX "leads_stage_idx" ON "leads"("stage");

-- CreateIndex
CREATE INDEX "leads_source_idx" ON "leads"("source");

-- CreateIndex
CREATE INDEX "lead_activities_lead_id_created_at_idx" ON "lead_activities"("lead_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_stripe_promotion_code_id_key" ON "promo_codes"("stripe_promotion_code_id");

-- CreateIndex
CREATE INDEX "promo_codes_status_idx" ON "promo_codes"("status");

-- CreateIndex
CREATE INDEX "facility_blocks_start_time_end_time_idx" ON "facility_blocks"("start_time", "end_time");

-- CreateIndex
CREATE INDEX "tasks_status_due_date_idx" ON "tasks"("status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "content_blocks_slot_key" ON "content_blocks"("slot");

-- CreateIndex
CREATE INDEX "credits_athlete_id_status_idx" ON "credits"("athlete_id", "status");

-- CreateIndex
CREATE INDEX "programs_status_idx" ON "programs"("status");

-- CreateIndex
CREATE INDEX "programs_program_type_status_idx" ON "programs"("program_type", "status");

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_duplicated_from_id_fkey" FOREIGN KEY ("duplicated_from_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credits" ADD CONSTRAINT "credits_eligible_program_id_fkey" FOREIGN KEY ("eligible_program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_credit_id_fkey" FOREIGN KEY ("credit_id") REFERENCES "credits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_created_by_staff_id_fkey" FOREIGN KEY ("created_by_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_eligible_program_id_fkey" FOREIGN KEY ("eligible_program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_blocks" ADD CONSTRAINT "facility_blocks_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_blocks" ADD CONSTRAINT "facility_blocks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_waivers" ADD CONSTRAINT "program_waivers_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_waivers" ADD CONSTRAINT "program_waivers_waiver_id_fkey" FOREIGN KEY ("waiver_id") REFERENCES "waivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
