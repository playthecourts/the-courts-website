-- Separates "an admin said they would tell people" from "the platform sent
-- something". No transport is wired up, so every row written today is
-- marked_manually; sent_automatically stays unused until one exists.
--
-- Without this, schedule_changes.families_notified = true reads as proof a
-- family was contacted, which is exactly the claim this table gets consulted
-- for when a parent says nobody told them.

-- CreateEnum
CREATE TYPE "NotificationMethod" AS ENUM ('marked_manually', 'sent_automatically');

-- AlterTable
ALTER TABLE "schedule_changes" ADD COLUMN     "notification_method" "NotificationMethod";

