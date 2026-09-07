-- CreateEnum
CREATE TYPE "CompetitiveMeter" AS ENUM ('here_to_learn', 'likes_a_challenge', 'keep_score');

-- CreateEnum
CREATE TYPE "EvaluationType" AS ENUM ('initial', 'league', 'skills', 'quarterly', 'custom');

-- CreateEnum
CREATE TYPE "EvaluationVisibility" AS ENUM ('internal_only', 'share_with_parent');

-- CreateEnum
CREATE TYPE "MediaConsentStatus" AS ENUM ('media_ok', 'media_limited', 'media_no');

-- CreateEnum
CREATE TYPE "ProgressReportStatus" AS ENUM ('draft', 'ready_for_review', 'published');

-- CreateEnum
CREATE TYPE "ProfileActorType" AS ENUM ('guardian', 'staff', 'system');

-- AlterTable
ALTER TABLE "athletes" ADD COLUMN     "basics_completed_at" TIMESTAMP(3),
ADD COLUMN     "coaching_preferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "competitive_meter" "CompetitiveMeter",
ADD COLUMN     "custody_restrictions" TEXT,
ADD COLUMN     "custody_staff_instruction" TEXT,
ADD COLUMN     "favorite_sport" TEXT,
ADD COLUMN     "goal" TEXT,
ADD COLUMN     "has_custody_restrictions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "has_medical_info" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nickname" TEXT,
ADD COLUMN     "other_sports" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "parent_coach_note" TEXT,
ADD COLUMN     "photo_path" TEXT,
ADD COLUMN     "photo_updated_at" TIMESTAMP(3),
ADD COLUMN     "profile_step" TEXT,
ADD COLUMN     "school" TEXT,
ADD COLUMN     "sports" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "evaluations" ADD COLUMN     "evaluation_type" "EvaluationType" NOT NULL DEFAULT 'league',
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "visibility" "EvaluationVisibility" NOT NULL DEFAULT 'internal_only',
ALTER COLUMN "program_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "family_guardians" ADD COLUMN     "authorized_for_pickup" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lives_with_athlete" BOOLEAN,
ADD COLUMN     "relationship" TEXT;

-- AlterTable
ALTER TABLE "guardians" ALTER COLUMN "auth_id" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "guardian_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authorized_pickups" (
    "id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "note" TEXT,
    "guardian_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authorized_pickups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_consents" (
    "id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "status" "MediaConsentStatus" NOT NULL,
    "consented_by_guardian_id" TEXT NOT NULL,
    "guardian_name" TEXT NOT NULL,
    "guardian_relationship" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "consent_date" TIMESTAMP(3) NOT NULL,
    "release_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_consent_changes" (
    "id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "old_status" "MediaConsentStatus",
    "new_status" "MediaConsentStatus" NOT NULL,
    "changed_by_guardian_id" TEXT,
    "changed_by_staff_id" TEXT,
    "release_version" TEXT NOT NULL,
    "needs_follow_up" BOOLEAN NOT NULL DEFAULT false,
    "follow_up_done_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_consent_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_reports" (
    "id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "status" "ProgressReportStatus" NOT NULL DEFAULT 'draft',
    "coach_take" TEXT,
    "up_next_focus" TEXT,
    "up_next_program_type" TEXT,
    "up_next_offering_id" TEXT,
    "participation" JSONB,
    "author_staff_id" TEXT NOT NULL,
    "reviewed_by_staff_id" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progress_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_skills" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "clicking" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "progress_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_priorities" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "progress_priorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_profile_changes" (
    "id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "actor_type" "ProfileActorType" NOT NULL,
    "actor_guardian_id" TEXT,
    "actor_staff_id" TEXT,
    "actor_label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "athlete_profile_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "emergency_contacts_athlete_id_sort_order_idx" ON "emergency_contacts"("athlete_id", "sort_order");

-- CreateIndex
CREATE INDEX "authorized_pickups_athlete_id_active_idx" ON "authorized_pickups"("athlete_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "media_consents_athlete_id_key" ON "media_consents"("athlete_id");

-- CreateIndex
CREATE INDEX "media_consent_changes_athlete_id_created_at_idx" ON "media_consent_changes"("athlete_id", "created_at");

-- CreateIndex
CREATE INDEX "media_consent_changes_needs_follow_up_follow_up_done_at_idx" ON "media_consent_changes"("needs_follow_up", "follow_up_done_at");

-- CreateIndex
CREATE INDEX "progress_reports_athlete_id_year_quarter_idx" ON "progress_reports"("athlete_id", "year", "quarter");

-- CreateIndex
CREATE INDEX "progress_reports_status_year_quarter_idx" ON "progress_reports"("status", "year", "quarter");

-- CreateIndex
CREATE UNIQUE INDEX "progress_reports_athlete_id_sport_year_quarter_key" ON "progress_reports"("athlete_id", "sport", "year", "quarter");

-- CreateIndex
CREATE UNIQUE INDEX "progress_skills_report_id_metric_key" ON "progress_skills"("report_id", "metric");

-- CreateIndex
CREATE INDEX "athlete_profile_changes_athlete_id_created_at_idx" ON "athlete_profile_changes"("athlete_id", "created_at");

-- CreateIndex
CREATE INDEX "athlete_profile_changes_category_created_at_idx" ON "athlete_profile_changes"("category", "created_at");

-- CreateIndex
CREATE INDEX "evaluations_athlete_id_created_at_idx" ON "evaluations"("athlete_id", "created_at");

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorized_pickups" ADD CONSTRAINT "authorized_pickups_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authorized_pickups" ADD CONSTRAINT "authorized_pickups_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_consents" ADD CONSTRAINT "media_consents_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_consents" ADD CONSTRAINT "media_consents_consented_by_guardian_id_fkey" FOREIGN KEY ("consented_by_guardian_id") REFERENCES "guardians"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_consent_changes" ADD CONSTRAINT "media_consent_changes_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_consent_changes" ADD CONSTRAINT "media_consent_changes_changed_by_guardian_id_fkey" FOREIGN KEY ("changed_by_guardian_id") REFERENCES "guardians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_consent_changes" ADD CONSTRAINT "media_consent_changes_changed_by_staff_id_fkey" FOREIGN KEY ("changed_by_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_reports" ADD CONSTRAINT "progress_reports_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_reports" ADD CONSTRAINT "progress_reports_author_staff_id_fkey" FOREIGN KEY ("author_staff_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_reports" ADD CONSTRAINT "progress_reports_reviewed_by_staff_id_fkey" FOREIGN KEY ("reviewed_by_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_skills" ADD CONSTRAINT "progress_skills_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "progress_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_priorities" ADD CONSTRAINT "progress_priorities_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "progress_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_profile_changes" ADD CONSTRAINT "athlete_profile_changes_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_profile_changes" ADD CONSTRAINT "athlete_profile_changes_actor_guardian_id_fkey" FOREIGN KEY ("actor_guardian_id") REFERENCES "guardians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_profile_changes" ADD CONSTRAINT "athlete_profile_changes_actor_staff_id_fkey" FOREIGN KEY ("actor_staff_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
