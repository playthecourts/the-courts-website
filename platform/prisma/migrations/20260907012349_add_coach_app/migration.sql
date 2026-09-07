-- CreateEnum
CREATE TYPE "CoachRole" AS ENUM ('lead', 'assistant', 'substitute');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'late', 'absent', 'excused');

-- CreateEnum
CREATE TYPE "NoteVisibility" AS ENUM ('staff_private', 'parent_shared');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('available', 'preferred', 'unavailable');

-- CreateEnum
CREATE TYPE "CoverageStatus" AS ENUM ('open', 'assigned', 'cancelled');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('injury', 'behavior', 'facility', 'other');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('open', 'under_review', 'closed');

-- CreateEnum
CREATE TYPE "CommunicationScope" AS ENUM ('session', 'team', 'program', 'family');

-- CreateEnum
CREATE TYPE "AthleteFlagType" AS ENUM ('new_athlete', 'first_session', 'needs_evaluation', 'parent_follow_up', 'attendance_concern');

-- AlterEnum
ALTER TYPE "StaffRole" ADD VALUE 'head_coach';

-- AlterTable
ALTER TABLE "staff_users" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "sports" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "session_coaches" (
    "session_id" TEXT NOT NULL,
    "staff_user_id" TEXT NOT NULL,
    "role" "CoachRole" NOT NULL DEFAULT 'lead',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_coaches_pkey" PRIMARY KEY ("session_id","staff_user_id")
);

-- CreateTable
CREATE TABLE "team_coaches" (
    "team_id" TEXT NOT NULL,
    "staff_user_id" TEXT NOT NULL,
    "role" "CoachRole" NOT NULL DEFAULT 'lead',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_coaches_pkey" PRIMARY KEY ("team_id","staff_user_id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "checked_in_at" TIMESTAMP(3),
    "recorded_by_id" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_notes" (
    "id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "staff_user_id" TEXT NOT NULL,
    "session_id" TEXT,
    "visibility" "NoteVisibility" NOT NULL DEFAULT 'staff_private',
    "body" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "focus" TEXT,
    "working_on" TEXT,
    "next_recommendation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_notes" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "staff_user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_plans" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "staff_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_plan_items" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "activity" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "session_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sport" TEXT,
    "category" TEXT,
    "created_by_id" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_template_items" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "activity" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "plan_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "staff_user_id" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "scores" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT,
    "recommended_level" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placement_requests" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "request_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "placement_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coach_availability" (
    "id" TEXT NOT NULL,
    "staff_user_id" TEXT NOT NULL,
    "weekday" INTEGER,
    "specific_date" DATE,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "status" "AvailabilityStatus" NOT NULL DEFAULT 'available',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coach_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverage_requests" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "reason" TEXT,
    "status" "CoverageStatus" NOT NULL DEFAULT 'open',
    "assigned_to_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "coverage_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_reports" (
    "id" TEXT NOT NULL,
    "session_id" TEXT,
    "athlete_id" TEXT,
    "reported_by_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "incident_type" "IncidentType" NOT NULL,
    "description" TEXT NOT NULL,
    "action_taken" TEXT NOT NULL,
    "parent_notified" BOOLEAN NOT NULL DEFAULT false,
    "admin_follow_up_required" BOOLEAN NOT NULL DEFAULT false,
    "status" "IncidentStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communications" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "scope" "CommunicationScope" NOT NULL,
    "session_id" TEXT,
    "team_id" TEXT,
    "program_id" TEXT,
    "family_id" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_recipients" (
    "id" TEXT NOT NULL,
    "communication_id" TEXT NOT NULL,
    "guardian_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "communication_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "sport" TEXT,
    "program_id" TEXT,
    "team_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_flags" (
    "id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "flag_type" "AthleteFlagType" NOT NULL,
    "note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "athlete_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dr_dish_logs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "staff_user_id" TEXT NOT NULL,
    "workout" TEXT,
    "makes" INTEGER,
    "attempts" INTEGER,
    "focus" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dr_dish_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "staff_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_coaches_staff_user_id_idx" ON "session_coaches"("staff_user_id");

-- CreateIndex
CREATE INDEX "team_coaches_staff_user_id_idx" ON "team_coaches"("staff_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_booking_id_key" ON "attendance_records"("booking_id");

-- CreateIndex
CREATE INDEX "coach_notes_athlete_id_created_at_idx" ON "coach_notes"("athlete_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "session_plans_session_id_key" ON "session_plans"("session_id");

-- CreateIndex
CREATE INDEX "session_plan_items_plan_id_position_idx" ON "session_plan_items"("plan_id", "position");

-- CreateIndex
CREATE INDEX "plan_template_items_template_id_position_idx" ON "plan_template_items"("template_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_program_id_athlete_id_staff_user_id_key" ON "evaluations"("program_id", "athlete_id", "staff_user_id");

-- CreateIndex
CREATE INDEX "coach_availability_staff_user_id_idx" ON "coach_availability"("staff_user_id");

-- CreateIndex
CREATE INDEX "coverage_requests_status_idx" ON "coverage_requests"("status");

-- CreateIndex
CREATE INDEX "incident_reports_status_idx" ON "incident_reports"("status");

-- CreateIndex
CREATE INDEX "communications_sent_at_idx" ON "communications"("sent_at");

-- CreateIndex
CREATE INDEX "communication_recipients_guardian_id_read_at_idx" ON "communication_recipients"("guardian_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "communication_recipients_communication_id_guardian_id_key" ON "communication_recipients"("communication_id", "guardian_id");

-- CreateIndex
CREATE INDEX "announcements_published_at_idx" ON "announcements"("published_at");

-- CreateIndex
CREATE INDEX "athlete_flags_athlete_id_active_idx" ON "athlete_flags"("athlete_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "dr_dish_logs_session_id_athlete_id_key" ON "dr_dish_logs"("session_id", "athlete_id");

-- CreateIndex
CREATE INDEX "audit_logs_staff_user_id_created_at_idx" ON "audit_logs"("staff_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "session_coaches" ADD CONSTRAINT "session_coaches_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_coaches" ADD CONSTRAINT "session_coaches_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_coaches" ADD CONSTRAINT "team_coaches_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_coaches" ADD CONSTRAINT "team_coaches_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_notes" ADD CONSTRAINT "coach_notes_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_notes" ADD CONSTRAINT "coach_notes_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_plans" ADD CONSTRAINT "session_plans_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_plans" ADD CONSTRAINT "session_plans_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_plan_items" ADD CONSTRAINT "session_plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "session_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_templates" ADD CONSTRAINT "plan_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_template_items" ADD CONSTRAINT "plan_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "plan_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_requests" ADD CONSTRAINT "placement_requests_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_requests" ADD CONSTRAINT "placement_requests_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coach_availability" ADD CONSTRAINT "coach_availability_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage_requests" ADD CONSTRAINT "coverage_requests_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage_requests" ADD CONSTRAINT "coverage_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage_requests" ADD CONSTRAINT "coverage_requests_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_recipients" ADD CONSTRAINT "communication_recipients_communication_id_fkey" FOREIGN KEY ("communication_id") REFERENCES "communications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_recipients" ADD CONSTRAINT "communication_recipients_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_flags" ADD CONSTRAINT "athlete_flags_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_flags" ADD CONSTRAINT "athlete_flags_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_dish_logs" ADD CONSTRAINT "dr_dish_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_dish_logs" ADD CONSTRAINT "dr_dish_logs_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dr_dish_logs" ADD CONSTRAINT "dr_dish_logs_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "staff_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
