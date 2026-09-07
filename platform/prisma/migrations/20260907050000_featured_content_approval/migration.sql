-- A separate approval for making one athlete the SUBJECT of content.
--
-- General media consent covers a child appearing in the ordinary content of
-- a gym. It does not cover a spotlight, testimonial, interview or campaign
-- centrepiece, which make the child the story rather than a participant.
-- media_ok is a precondition for these, never a substitute.

-- CreateEnum
CREATE TYPE "FeaturedContentKind" AS ENUM ('spotlight', 'testimonial', 'interview', 'full_name_feature', 'campaign_centerpiece', 'other');

-- CreateEnum
CREATE TYPE "FeaturedApprovalStatus" AS ENUM ('requested', 'approved', 'declined', 'expired', 'withdrawn');

-- CreateTable
CREATE TABLE "featured_content_approvals" (
    "id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "kind" "FeaturedContentKind" NOT NULL,
    "description" TEXT NOT NULL,
    "intended_use" TEXT,
    "uses_full_name" BOOLEAN NOT NULL DEFAULT false,
    "status" "FeaturedApprovalStatus" NOT NULL DEFAULT 'requested',
    "requested_by_id" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by_guardian_id" TEXT,
    "decided_by_name" TEXT,
    "decided_at" TIMESTAMP(3),
    "guardian_note" TEXT,
    "expires_at" TIMESTAMP(3),
    "release_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "featured_content_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "featured_content_approvals_athlete_id_status_idx" ON "featured_content_approvals"("athlete_id", "status");

-- CreateIndex
CREATE INDEX "featured_content_approvals_status_requested_at_idx" ON "featured_content_approvals"("status", "requested_at");

-- AddForeignKey
ALTER TABLE "featured_content_approvals" ADD CONSTRAINT "featured_content_approvals_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_content_approvals" ADD CONSTRAINT "featured_content_approvals_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_content_approvals" ADD CONSTRAINT "featured_content_approvals_decided_by_guardian_id_fkey" FOREIGN KEY ("decided_by_guardian_id") REFERENCES "guardians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

