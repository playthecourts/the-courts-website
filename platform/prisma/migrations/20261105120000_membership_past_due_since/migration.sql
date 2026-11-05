-- When a membership most recently went past_due. Set/cleared by the Stripe
-- webhook. Informational; past_due blocks booking immediately
-- (lib/membership-standing.ts).
ALTER TABLE "athlete_memberships" ADD COLUMN IF NOT EXISTS "past_due_since" TIMESTAMP(3);
