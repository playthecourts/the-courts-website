-- When a membership most recently went past_due. Set/cleared by the Stripe
-- webhook; drives the 5-day booking grace period (lib/membership-standing.ts).
-- A past_due row left NULL is treated as past the grace period.
ALTER TABLE "athlete_memberships" ADD COLUMN IF NOT EXISTS "past_due_since" TIMESTAMP(3);
