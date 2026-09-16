-- CreateEnum
CREATE TYPE "NextGenStatus" AS ENUM ('current_nextgen', 'former_nextgen');

-- CreateEnum
CREATE TYPE "NextGenVerification" AS ENUM ('unverified', 'verified', 'not_eligible');

-- AlterTable
ALTER TABLE "guardians" ADD COLUMN     "is_founder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "legacy_rate_cents" INTEGER,
ADD COLUMN     "next_gen_status" "NextGenStatus",
ADD COLUMN     "next_gen_verification" "NextGenVerification";
