-- Overflow ceiling above a session's advertised capacity: past `capacity` the
-- class shows as full, but waitlist joins are moved straight in until bookings
-- reach overflow_capacity (lib/booking.ts). Null = no overflow.
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "overflow_capacity" INTEGER;
ALTER TABLE "offerings" ADD COLUMN IF NOT EXISTS "default_overflow_capacity" INTEGER;
