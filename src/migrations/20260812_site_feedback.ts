import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const SITE_FEEDBACK_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS "feedback_submissions" (
  "id" serial PRIMARY KEY,
  "comment" varchar NOT NULL,
  "email" varchar,
  "source_url" varchar NOT NULL,
  "client_address_digest" varchar NOT NULL,
  "user_agent" varchar,
  "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "feedback_submissions_updated_at_idx" ON "feedback_submissions" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "feedback_submissions_created_at_idx" ON "feedback_submissions" USING btree ("created_at");

ALTER TABLE "site_settings"
  ADD COLUMN IF NOT EXISTS "feedback_enabled" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "feedback_banner_copy" varchar DEFAULT 'Help us improve the new ev.church.',
  ADD COLUMN IF NOT EXISTS "feedback_cta_label" varchar DEFAULT 'Share feedback.',
  ADD COLUMN IF NOT EXISTS "feedback_modal_title" varchar DEFAULT 'Share your feedback',
  ADD COLUMN IF NOT EXISTS "feedback_modal_intro" varchar DEFAULT 'Tell us what is working well or what we could improve.',
  ADD COLUMN IF NOT EXISTS "feedback_dismissal_version" varchar DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS "feedback_end_date" timestamp(3) with time zone;

CREATE TABLE IF NOT EXISTS "site_feedback_rate_limits" (
  "id" serial PRIMARY KEY,
  "bucket_digest" varchar NOT NULL,
  "window_started_at" timestamp(3) with time zone NOT NULL,
  "count" integer NOT NULL DEFAULT 1,
  "expires_at" timestamp(3) with time zone NOT NULL,
  CONSTRAINT "site_feedback_rate_limits_bucket_window_unique" UNIQUE ("bucket_digest", "window_started_at")
);
CREATE INDEX IF NOT EXISTS "site_feedback_rate_limits_expires_at_idx" ON "site_feedback_rate_limits" USING btree ("expires_at");
COMMENT ON TABLE "site_feedback_rate_limits" IS 'bounded cleanup: oldest 100 expired rows per request';
`

export const SITE_FEEDBACK_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "feedback_submissions") THEN
    RAISE EXCEPTION 'Cannot roll back Site Feedback while submissions exist';
  END IF;
END $$;

DROP TABLE IF EXISTS "site_feedback_rate_limits";
DROP TABLE IF EXISTS "feedback_submissions";
ALTER TABLE "site_settings"
  DROP COLUMN IF EXISTS "feedback_enabled",
  DROP COLUMN IF EXISTS "feedback_banner_copy",
  DROP COLUMN IF EXISTS "feedback_cta_label",
  DROP COLUMN IF EXISTS "feedback_modal_title",
  DROP COLUMN IF EXISTS "feedback_modal_intro",
  DROP COLUMN IF EXISTS "feedback_dismissal_version",
  DROP COLUMN IF EXISTS "feedback_end_date";
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(SITE_FEEDBACK_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(SITE_FEEDBACK_DOWN_SQL))
}
