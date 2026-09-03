-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('booked', 'cancelled', 'attended', 'no_show');

-- CreateEnum
CREATE TYPE "WaitlistEntryStatus" AS ENUM ('waiting', 'converted');

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "booked_by_guardian_id" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'booked',
    "price_charged_cents" INTEGER,
    "booked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "WaitlistEntryStatus" NOT NULL DEFAULT 'waiting',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_session_id_athlete_id_key" ON "bookings"("session_id", "athlete_id");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_session_id_athlete_id_key" ON "waitlist_entries"("session_id", "athlete_id");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booked_by_guardian_id_fkey" FOREIGN KEY ("booked_by_guardian_id") REFERENCES "guardians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
