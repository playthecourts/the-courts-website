-- Records which Training Plan benefit paid for a seat, and whether a
-- Courts-side cancellation has already returned that credit. Without the
-- flag, re-running the cancellation flow would restore the same credit twice.

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "credit_restored" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "credit_source" TEXT;

