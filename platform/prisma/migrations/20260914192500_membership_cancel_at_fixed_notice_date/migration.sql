-- AlterTable
ALTER TABLE "athlete_memberships" DROP COLUMN "cancel_at_period_end",
ADD COLUMN     "cancel_at" TIMESTAMP(3);
