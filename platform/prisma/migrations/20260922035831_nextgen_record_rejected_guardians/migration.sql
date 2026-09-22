-- AlterTable
ALTER TABLE "next_gen_records" ADD COLUMN     "rejected_guardian_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
