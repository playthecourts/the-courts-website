-- CreateEnum
CREATE TYPE "EmergencyContactRole" AS ENUM ('primary', 'backup');

-- AlterTable
ALTER TABLE "emergency_contacts" ADD COLUMN "role" "EmergencyContactRole" NOT NULL DEFAULT 'primary';

-- CreateIndex
CREATE UNIQUE INDEX "emergency_contacts_athlete_id_role_key" ON "emergency_contacts"("athlete_id", "role");
