-- Add PaymentStatus columns to bookings (reusing the existing payment_status enum)
ALTER TABLE "bookings" ADD COLUMN "payment_status" "PaymentStatus" NOT NULL DEFAULT 'none';
ALTER TABLE "bookings" ADD COLUMN "stripe_checkout_session_id" TEXT;
ALTER TABLE "bookings" ADD COLUMN "checkout_expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "bookings_stripe_checkout_session_id_key" ON "bookings"("stripe_checkout_session_id");

-- Companion ("bring a teammate") pricing on offerings
ALTER TABLE "offerings" ADD COLUMN "companion_price_cents" INTEGER;
