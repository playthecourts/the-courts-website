-- AlterTable
ALTER TABLE "waiver_signatures" ADD COLUMN     "accepted_content" TEXT,
ADD COLUMN     "accepted_version" TEXT;

-- CreateTable
CREATE TABLE "waiver_signature_athletes" (
    "waiver_signature_id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,

    CONSTRAINT "waiver_signature_athletes_pkey" PRIMARY KEY ("waiver_signature_id","athlete_id")
);

-- CreateIndex
CREATE INDEX "waiver_signature_athletes_athlete_id_idx" ON "waiver_signature_athletes"("athlete_id");

-- CreateIndex
CREATE INDEX "waiver_signatures_guardian_id_waiver_id_idx" ON "waiver_signatures"("guardian_id", "waiver_id");

-- AddForeignKey
ALTER TABLE "waiver_signature_athletes" ADD CONSTRAINT "waiver_signature_athletes_waiver_signature_id_fkey" FOREIGN KEY ("waiver_signature_id") REFERENCES "waiver_signatures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiver_signature_athletes" ADD CONSTRAINT "waiver_signature_athletes_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
