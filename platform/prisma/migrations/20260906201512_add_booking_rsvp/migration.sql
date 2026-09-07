-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('going', 'not_going', 'not_sure');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "rsvp_status" "RsvpStatus";

