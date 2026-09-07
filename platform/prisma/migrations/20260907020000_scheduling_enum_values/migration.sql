-- Enum values only.
--
-- IF NOT EXISTS because these were committed ahead of the structural migration
-- during its dry run; re-running this file must be a no-op.
--
-- Postgres refuses to use a newly added enum value inside the transaction that
-- added it, and the next migration's data backfill needs these values. So they
-- are committed here first, alone, and the structural change follows.

ALTER TYPE "CoachRole" ADD VALUE IF NOT EXISTS 'check_in';
ALTER TYPE "CoachRole" ADD VALUE IF NOT EXISTS 'event_lead';
ALTER TYPE "CoachRole" ADD VALUE IF NOT EXISTS 'court_lead';
ALTER TYPE "CoachRole" ADD VALUE IF NOT EXISTS 'other';
ALTER TYPE "ProgramType" ADD VALUE IF NOT EXISTS 'group_training';
ALTER TYPE "ProgramType" ADD VALUE IF NOT EXISTS 'private_training';
ALTER TYPE "ProgramType" ADD VALUE IF NOT EXISTS 'skills_clinic';
ALTER TYPE "ProgramType" ADD VALUE IF NOT EXISTS 'evaluation';
ALTER TYPE "ProgramType" ADD VALUE IF NOT EXISTS 'guided_dr_dish';
ALTER TYPE "ProgramType" ADD VALUE IF NOT EXISTS 'self_serve_dr_dish';
ALTER TYPE "ProgramType" ADD VALUE IF NOT EXISTS 'open_gym';
ALTER TYPE "ProgramType" ADD VALUE IF NOT EXISTS 'court_rental';
ALTER TYPE "ProgramType" ADD VALUE IF NOT EXISTS 'party';
ALTER TYPE "ProgramType" ADD VALUE IF NOT EXISTS 'special_event';
ALTER TYPE "WaitlistEntryStatus" ADD VALUE IF NOT EXISTS 'offered';
ALTER TYPE "WaitlistEntryStatus" ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE "WaitlistEntryStatus" ADD VALUE IF NOT EXISTS 'declined';
ALTER TYPE "WaitlistEntryStatus" ADD VALUE IF NOT EXISTS 'expired';
