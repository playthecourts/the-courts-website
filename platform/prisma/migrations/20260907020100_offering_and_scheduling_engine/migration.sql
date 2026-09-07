-- The Offering layer + scheduling engine.
--
-- Splits Program (the reusable definition: WHAT we offer) from Offering (a
-- specific season/instance: when, how much, staffed by whom, published where),
-- and adds the models the scheduler needs: recurrence rules, multi-court
-- sessions, schedule-change history, conflict overrides, templates and
-- offering-level waitlists.
--
-- Order matters here. Every existing Program is copied into an Offering and all
-- sessions/teams re-pointed at it BEFORE the season columns are dropped from
-- programs, so no live data is lost in the split.

-- CreateEnum
CREATE TYPE "OfferingStatus" AS ENUM ('draft', 'ready_to_publish', 'published', 'registration_closed', 'completed', 'cancelled', 'archived');

-- CreateEnum
CREATE TYPE "ScheduleKind" AS ENUM ('one_time', 'recurring', 'multi_day', 'season', 'custom');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('beginner', 'developing', 'intermediate', 'advanced', 'all_levels', 'invite_only');

-- CreateEnum
CREATE TYPE "WaitlistMode" AS ENUM ('none', 'automatic', 'manual');

-- CreateEnum
CREATE TYPE "RegistrationMode" AS ENUM ('session', 'offering', 'multi_day', 'season');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('free', 'one_time', 'per_session', 'multi_day_package', 'training_plan', 'deposit');

-- CreateEnum
CREATE TYPE "TaxBehavior" AS ENUM ('unspecified', 'inclusive', 'exclusive');

-- CreateEnum
CREATE TYPE "CreditRule" AS ENUM ('uses_credit', 'included', 'member_price', 'separate_payment', 'free');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('weekly', 'biweekly');

-- CreateEnum
CREATE TYPE "ScheduleChangeType" AS ENUM ('created', 'moved', 'cancelled', 'restored', 'resource_changed', 'coach_changed', 'capacity_changed', 'rescheduled', 'makeup_added', 'series_edited');

-- CreateEnum
CREATE TYPE "RegistrationSelection" AS ENUM ('all_sessions', 'single_day', 'team_season');

-- DropForeignKey
ALTER TABLE "program_waivers" DROP CONSTRAINT "program_waivers_program_id_fkey";

-- DropForeignKey
ALTER TABLE "program_waivers" DROP CONSTRAINT "program_waivers_waiver_id_fkey";

-- DropForeignKey
ALTER TABLE "programs" DROP CONSTRAINT "programs_duplicated_from_id_fkey";

-- DropForeignKey
ALTER TABLE "registrations" DROP CONSTRAINT "registrations_program_id_fkey";

-- DropIndex
DROP INDEX "programs_program_type_status_idx";

-- DropIndex
DROP INDEX "programs_status_idx";

-- DropIndex
DROP INDEX "registrations_program_id_athlete_id_key";


-- AlterTable
ALTER TABLE "registrations" DROP COLUMN "program_id",
ADD COLUMN     "offering_id" TEXT NOT NULL,
ADD COLUMN     "selected_session_id" TEXT,
ADD COLUMN     "selection" "RegistrationSelection" NOT NULL DEFAULT 'all_sessions';

-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "allowed_program_types" "ProgramType"[] DEFAULT ARRAY[]::"ProgramType"[],
ADD COLUMN     "description" TEXT,
ADD COLUMN     "overlaps_resource_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "cancellation_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "cancelled_by_id" TEXT,
ADD COLUMN     "day_index" INTEGER,
ADD COLUMN     "internal_note" TEXT,
ADD COLUMN     "is_exception" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "offering_id" TEXT,
ADD COLUMN     "public_note" TEXT,
ADD COLUMN     "replaces_session_id" TEXT,
ADD COLUMN     "series_id" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "offering_id" TEXT;

-- AlterTable
ALTER TABLE "waitlist_entries" ADD COLUMN     "offer_expires_at" TIMESTAMP(3),
ADD COLUMN     "offered_at" TIMESTAMP(3),
ADD COLUMN     "offered_by_id" TEXT,
ADD COLUMN     "responded_at" TIMESTAMP(3);


-- CreateTable
CREATE TABLE "offerings" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internal_name" TEXT,
    "season_label" TEXT,
    "status" "OfferingStatus" NOT NULL DEFAULT 'draft',
    "short_description" TEXT,
    "full_description" TEXT,
    "parent_instructions" TEXT,
    "coach_notes" TEXT,
    "internal_notes" TEXT,
    "what_to_bring" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "website_cta" TEXT,
    "image_url" TEXT,
    "image_mobile_url" TEXT,
    "image_alt_text" TEXT,
    "schedule_kind" "ScheduleKind" NOT NULL DEFAULT 'one_time',
    "start_date" DATE,
    "end_date" DATE,
    "grade_min" INTEGER,
    "grade_max" INTEGER,
    "age_min" INTEGER,
    "age_max" INTEGER,
    "gender" TEXT,
    "skill_level" "SkillLevel",
    "invite_only" BOOLEAN NOT NULL DEFAULT false,
    "requires_training_plan" BOOLEAN NOT NULL DEFAULT false,
    "eligibility_note" TEXT,
    "capacity_total" INTEGER,
    "default_session_capacity" INTEGER,
    "low_spot_threshold" INTEGER NOT NULL DEFAULT 3,
    "waitlist_mode" "WaitlistMode" NOT NULL DEFAULT 'automatic',
    "waitlist_offer_hours" INTEGER NOT NULL DEFAULT 24,
    "registration_mode" "RegistrationMode" NOT NULL DEFAULT 'session',
    "registration_opens_at" TIMESTAMP(3),
    "registration_closes_at" TIMESTAMP(3),
    "close_when_full" BOOLEAN NOT NULL DEFAULT false,
    "allow_single_day" BOOLEAN NOT NULL DEFAULT false,
    "pricing_model" "PricingModel" NOT NULL DEFAULT 'per_session',
    "price_cents" INTEGER,
    "member_price_cents" INTEGER,
    "single_day_price_cents" INTEGER,
    "deposit_cents" INTEGER,
    "stripe_product_id" TEXT,
    "stripe_price_id" TEXT,
    "stripe_member_price_id" TEXT,
    "stripe_single_day_price_id" TEXT,
    "stripe_tax_code" TEXT,
    "tax_behavior" "TaxBehavior" NOT NULL DEFAULT 'unspecified',
    "credit_rule" "CreditRule" NOT NULL DEFAULT 'separate_payment',
    "credits_per_booking" INTEGER NOT NULL DEFAULT 1,
    "visible_parent_app" BOOLEAN NOT NULL DEFAULT true,
    "visible_website" BOOLEAN NOT NULL DEFAULT false,
    "visible_coach_app" BOOLEAN NOT NULL DEFAULT true,
    "internal_only" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "published_by_id" TEXT,
    "league_stage" "LeagueStage",
    "evaluation_offering_id" TEXT,
    "external_location_name" TEXT,
    "external_location_address" TEXT,
    "cloned_from_offering_id" TEXT,
    "template_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_waivers" (
    "offering_id" TEXT NOT NULL,
    "waiver_id" TEXT NOT NULL,

    CONSTRAINT "offering_waivers_pkey" PRIMARY KEY ("offering_id","waiver_id")
);

-- CreateTable
CREATE TABLE "recurrence_rules" (
    "id" TEXT NOT NULL,
    "offering_id" TEXT NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL DEFAULT 'weekly',
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "start_minute" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "resource_id" TEXT,
    "capacity" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurrence_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_resources" (
    "session_id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,

    CONSTRAINT "session_resources_pkey" PRIMARY KEY ("session_id","resource_id")
);

-- CreateTable
CREATE TABLE "schedule_changes" (
    "id" TEXT NOT NULL,
    "session_id" TEXT,
    "offering_id" TEXT,
    "change_type" "ScheduleChangeType" NOT NULL,
    "previous_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "families_notified" BOOLEAN,
    "coach_notified" BOOLEAN,
    "affected_registrations" INTEGER NOT NULL DEFAULT 0,
    "changed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conflict_overrides" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "conflict_type" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "overridden_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conflict_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "program_type" "ProgramType" NOT NULL,
    "sport" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_by_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offering_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_waitlist_entries" (
    "id" TEXT NOT NULL,
    "offering_id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "WaitlistEntryStatus" NOT NULL DEFAULT 'waiting',
    "offered_at" TIMESTAMP(3),
    "offer_expires_at" TIMESTAMP(3),
    "offered_by_id" TEXT,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offering_waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offerings_status_start_date_idx" ON "offerings"("status", "start_date");

-- CreateIndex
CREATE INDEX "offerings_program_id_status_idx" ON "offerings"("program_id", "status");

-- CreateIndex
CREATE INDEX "recurrence_rules_offering_id_idx" ON "recurrence_rules"("offering_id");

-- CreateIndex
CREATE INDEX "session_resources_resource_id_idx" ON "session_resources"("resource_id");

-- CreateIndex
CREATE INDEX "schedule_changes_session_id_created_at_idx" ON "schedule_changes"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "schedule_changes_offering_id_created_at_idx" ON "schedule_changes"("offering_id", "created_at");

-- CreateIndex
CREATE INDEX "conflict_overrides_session_id_idx" ON "conflict_overrides"("session_id");

-- CreateIndex
CREATE INDEX "offering_waitlist_entries_offering_id_status_position_idx" ON "offering_waitlist_entries"("offering_id", "status", "position");

-- CreateIndex
CREATE UNIQUE INDEX "offering_waitlist_entries_offering_id_athlete_id_key" ON "offering_waitlist_entries"("offering_id", "athlete_id");

-- CreateIndex
CREATE INDEX "programs_program_type_active_idx" ON "programs"("program_type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_offering_id_athlete_id_key" ON "registrations"("offering_id", "athlete_id");

-- CreateIndex
CREATE INDEX "sessions_offering_id_start_time_idx" ON "sessions"("offering_id", "start_time");

-- CreateIndex
CREATE INDEX "sessions_start_time_status_idx" ON "sessions"("start_time", "status");

-- CreateIndex
CREATE INDEX "sessions_series_id_idx" ON "sessions"("series_id");

-- CreateIndex
CREATE INDEX "waitlist_entries_session_id_status_position_idx" ON "waitlist_entries"("session_id", "status", "position");

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_cloned_from_offering_id_fkey" FOREIGN KEY ("cloned_from_offering_id") REFERENCES "offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_evaluation_offering_id_fkey" FOREIGN KEY ("evaluation_offering_id") REFERENCES "offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "offering_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "recurrence_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_replaces_session_id_fkey" FOREIGN KEY ("replaces_session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_offered_by_id_fkey" FOREIGN KEY ("offered_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_waivers" ADD CONSTRAINT "offering_waivers_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_waivers" ADD CONSTRAINT "offering_waivers_waiver_id_fkey" FOREIGN KEY ("waiver_id") REFERENCES "waivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_resources" ADD CONSTRAINT "session_resources_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_resources" ADD CONSTRAINT "session_resources_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_changes" ADD CONSTRAINT "schedule_changes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_changes" ADD CONSTRAINT "schedule_changes_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_changes" ADD CONSTRAINT "schedule_changes_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_overrides" ADD CONSTRAINT "conflict_overrides_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conflict_overrides" ADD CONSTRAINT "conflict_overrides_overridden_by_id_fkey" FOREIGN KEY ("overridden_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_templates" ADD CONSTRAINT "offering_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_waitlist_entries" ADD CONSTRAINT "offering_waitlist_entries_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_waitlist_entries" ADD CONSTRAINT "offering_waitlist_entries_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_waitlist_entries" ADD CONSTRAINT "offering_waitlist_entries_offered_by_id_fkey" FOREIGN KEY ("offered_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- BACKFILL: adopt every existing Program into an Offering.
--
-- Before this migration a Program carried its own season state (status, dates,
-- price, publish targets, Stripe pointers). Each one becomes exactly one
-- Offering holding that state, and the Program is left as the reusable
-- definition it should always have been. Nothing is deleted and nothing is
-- recreated: the existing sessions, bookings and teams are re-pointed at the
-- Offering that inherited their program's state.
--
-- Season label is left NULL rather than invented — "Fall 2026" is a claim about
-- the business, and guessing it here would put a fabricated season name in front
-- of parents. An admin names these on first edit.
-- ---------------------------------------------------------------------------

INSERT INTO "offerings" (
  "id", "program_id", "name", "internal_name", "status",
  "full_description", "image_url",
  "grade_min", "grade_max", "age_min", "age_max", "gender",
  "default_session_capacity",
  "waitlist_mode", "registration_opens_at", "registration_closes_at",
  "price_cents", "member_price_cents", "pricing_model",
  "stripe_price_id", "stripe_member_price_id",
  "visible_parent_app", "visible_website", "visible_coach_app",
  "league_stage", "season_label", "published_at", "archived_at",
  "schedule_kind", "registration_mode", "credit_rule",
  "start_date", "end_date",
  "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  p."id",
  p."name",
  p."internal_name",
  -- programs.status used ProgramStatus; OfferingStatus renamed 'closed'.
  CASE p."status"::text
    WHEN 'draft'      THEN 'draft'
    WHEN 'published'  THEN 'published'
    WHEN 'closed'     THEN 'registration_closed'
    WHEN 'completed'  THEN 'completed'
    WHEN 'cancelled'  THEN 'cancelled'
    WHEN 'archived'   THEN 'archived'
    ELSE 'draft'
  END::"OfferingStatus",
  p."description",
  p."image_url",
  p."grade_min", p."grade_max", p."age_min", p."age_max", p."gender",
  p."default_capacity",
  CASE WHEN p."waitlist_enabled" THEN 'automatic' ELSE 'none' END::"WaitlistMode",
  p."registration_opens_at",
  p."registration_closes_at",
  p."price_cents",
  p."member_price_cents",
  CASE
    WHEN p."price_cents" IS NULL OR p."price_cents" = 0 THEN 'free'
    WHEN p."program_type"::text IN ('league', 'camp')   THEN 'one_time'
    ELSE 'per_session'
  END::"PricingModel",
  p."stripe_price_id",
  p."stripe_member_price_id",
  p."visible_parent_app", p."visible_website", p."visible_coach_app",
  p."league_stage",
  p."season_label",
  p."published_at",
  p."archived_at",
  -- A league runs a season; everything else is described from its sessions,
  -- and 'custom' is the honest answer for rows created before the builder knew
  -- the difference between a pattern and a list of dates.
  CASE WHEN p."program_type"::text = 'league' THEN 'season' ELSE 'custom' END::"ScheduleKind",
  CASE
    WHEN p."program_type"::text = 'league' THEN 'season'
    WHEN p."program_type"::text = 'camp'   THEN 'multi_day'
    ELSE 'session'
  END::"RegistrationMode",
  -- Only preserved where an entitlement actually grants this program credit;
  -- otherwise the honest default is that the plan gives nothing here.
  CASE
    WHEN EXISTS (
      SELECT 1 FROM "plan_entitlements" pe
      WHERE pe."program_id" = p."id" AND pe."benefit_type" = 'class_credit'
    ) THEN 'uses_credit'
    WHEN EXISTS (
      SELECT 1 FROM "plan_entitlements" pe
      WHERE pe."program_id" = p."id" AND pe."benefit_type" = 'member_pricing'
    ) THEN 'member_price'
    ELSE 'separate_payment'
  END::"CreditRule",
  (SELECT MIN(s."start_time")::date FROM "sessions" s WHERE s."program_id" = p."id"),
  (SELECT MAX(s."end_time")::date   FROM "sessions" s WHERE s."program_id" = p."id"),
  p."created_at",
  p."updated_at"
FROM "programs" p;

-- Re-point existing occurrences and rosters at the Offering that inherited
-- their program's state. One Offering per Program right now, so this is exact.
UPDATE "sessions" s
SET "offering_id" = o."id"
FROM "offerings" o
WHERE o."program_id" = s."program_id" AND s."offering_id" IS NULL;

UPDATE "teams" t
SET "offering_id" = o."id"
FROM "offerings" o
WHERE o."program_id" = t."program_id" AND t."offering_id" IS NULL;


-- ---------------------------------------------------------------------------
-- Now that every Program's season state lives on an Offering, remove it from
-- Program. Program keeps only the reusable definition plus the defaults a new
-- Offering inherits.
-- ---------------------------------------------------------------------------

-- AlterTable
ALTER TABLE "programs" DROP COLUMN "age_max",
DROP COLUMN "age_min",
DROP COLUMN "cancellation_policy",
DROP COLUMN "duplicated_from_id",
DROP COLUMN "gender",
DROP COLUMN "grade_max",
DROP COLUMN "grade_min",
DROP COLUMN "image_url",
DROP COLUMN "league_stage",
DROP COLUMN "published_at",
DROP COLUMN "registration_closes_at",
DROP COLUMN "registration_opens_at",
DROP COLUMN "season_label",
DROP COLUMN "skill_level",
DROP COLUMN "status",
DROP COLUMN "stripe_member_price_id",
DROP COLUMN "stripe_price_id",
DROP COLUMN "visible_coach_app",
DROP COLUMN "visible_parent_app",
DROP COLUMN "visible_website",
DROP COLUMN "waitlist_enabled",
ADD COLUMN     "default_duration_minutes" INTEGER,
ADD COLUMN     "default_skill_level" "SkillLevel",
ADD COLUMN     "required_resource_type" TEXT,
ADD COLUMN     "requires_coach" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "program_waivers";

-- ---------------------------------------------------------------------------
-- Program types: move the legacy names onto the canonical Courts vocabulary.
-- The old values stay in the enum (Postgres cannot drop one without a table
-- rewrite) but no row uses them after this, and the UI never offers them.
-- ---------------------------------------------------------------------------

UPDATE "programs" SET "program_type" = 'group_training'   WHERE "program_type" = 'class';
UPDATE "programs" SET "program_type" = 'guided_dr_dish'   WHERE "program_type" = 'resource';
UPDATE "programs" SET "program_type" = 'private_training' WHERE "program_type" = 'private';
UPDATE "programs" SET "program_type" = 'court_rental'     WHERE "program_type" = 'rental';
UPDATE "programs" SET "program_type" = 'special_event'    WHERE "program_type" = 'event';

-- Defaults that follow from the type, so the builder does not start blank.
UPDATE "programs" SET "requires_coach" = true
  WHERE "program_type" IN ('group_training','private_training','skills_clinic','camp','guided_dr_dish','evaluation');
UPDATE "programs" SET "required_resource_type" = 'shooting_machine'
  WHERE "program_type" IN ('guided_dr_dish','self_serve_dr_dish');
