-- A partial facility closure is internal by default (a cleaning window, a
-- league practice). Setting show_on_website publishes it on the public
-- schedule as a closure notice for that day.
ALTER TABLE "facility_blocks" ADD COLUMN IF NOT EXISTS "show_on_website" BOOLEAN NOT NULL DEFAULT false;
