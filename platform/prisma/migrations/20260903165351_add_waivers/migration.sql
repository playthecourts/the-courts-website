-- CreateEnum
CREATE TYPE "WaiverScope" AS ENUM ('family', 'athlete');

-- CreateTable
CREATE TABLE "waivers" (
    "id" TEXT NOT NULL,
    "waiver_type" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "scope" "WaiverScope" NOT NULL DEFAULT 'family',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "effective_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waiver_signatures" (
    "id" TEXT NOT NULL,
    "guardian_id" TEXT NOT NULL,
    "athlete_id" TEXT,
    "waiver_id" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,

    CONSTRAINT "waiver_signatures_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "waiver_signatures" ADD CONSTRAINT "waiver_signatures_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiver_signatures" ADD CONSTRAINT "waiver_signatures_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiver_signatures" ADD CONSTRAINT "waiver_signatures_waiver_id_fkey" FOREIGN KEY ("waiver_id") REFERENCES "waivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
