import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const SITE_FEEDBACK_EMAIL_NOTIFICATIONS_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$ BEGIN
  CREATE TYPE "public"."enum_feedback_submissions_notification_status" AS ENUM(
    'disabled', 'pending', 'sending', 'sent', 'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "feedback_submissions"
  ADD COLUMN IF NOT EXISTS "notification_status" "enum_feedback_submissions_notification_status" NOT NULL DEFAULT 'disabled',
  ADD COLUMN IF NOT EXISTS "notification_recipient" varchar,
  ADD COLUMN IF NOT EXISTS "notification_attempt_count" numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "notification_window_started_at" timestamp(3) with time zone,
  ADD COLUMN IF NOT EXISTS "notification_last_attempt_at" timestamp(3) with time zone,
  ADD COLUMN IF NOT EXISTS "notification_lease_token" varchar,
  ADD COLUMN IF NOT EXISTS "notification_lease_expires_at" timestamp(3) with time zone,
  ADD COLUMN IF NOT EXISTS "notification_sent_at" timestamp(3) with time zone,
  ADD COLUMN IF NOT EXISTS "notification_provider_id" varchar,
  ADD COLUMN IF NOT EXISTS "notification_error" varchar;

CREATE INDEX IF NOT EXISTS "feedback_submissions_notification_status_idx"
  ON "feedback_submissions" USING btree ("notification_status");
CREATE INDEX IF NOT EXISTS "feedback_submissions_notification_lease_expires_at_idx"
  ON "feedback_submissions" USING btree ("notification_lease_expires_at");

DO $$ BEGIN
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug"
    ADD VALUE IF NOT EXISTS 'sendSiteFeedbackNotification';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug"
    ADD VALUE IF NOT EXISTS 'reconcileSiteFeedbackNotifications';
  ALTER TYPE "public"."enum_payload_jobs_task_slug"
    ADD VALUE IF NOT EXISTS 'sendSiteFeedbackNotification';
  ALTER TYPE "public"."enum_payload_jobs_task_slug"
    ADD VALUE IF NOT EXISTS 'reconcileSiteFeedbackNotifications';
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE "payload_jobs"
  ADD COLUMN IF NOT EXISTS "meta" jsonb;

CREATE TABLE IF NOT EXISTS "payload_jobs_stats" (
  "id" serial PRIMARY KEY,
  "stats" jsonb,
  "updated_at" timestamp(3) with time zone,
  "created_at" timestamp(3) with time zone
);

-- Payload's shared jobs schema is intentionally forward-only here. Removing
-- it during a feedback rollback could break unrelated current or future jobs.

ALTER TABLE "site_settings"
  ADD COLUMN IF NOT EXISTS "feedback_notification_recipient" varchar DEFAULT 'tataihono@ev.church';
`

export const SITE_FEEDBACK_EMAIL_NOTIFICATIONS_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "feedback_submissions"
    WHERE "notification_status" <> 'disabled'
       OR "notification_recipient" IS NOT NULL
       OR "notification_attempt_count" <> 0
  ) THEN
    RAISE EXCEPTION 'Cannot roll back feedback notifications while notification state exists';
  END IF;
END $$;

DROP INDEX IF EXISTS "feedback_submissions_notification_lease_expires_at_idx";
DROP INDEX IF EXISTS "feedback_submissions_notification_status_idx";
ALTER TABLE "feedback_submissions"
  DROP COLUMN IF EXISTS "notification_status",
  DROP COLUMN IF EXISTS "notification_recipient",
  DROP COLUMN IF EXISTS "notification_attempt_count",
  DROP COLUMN IF EXISTS "notification_window_started_at",
  DROP COLUMN IF EXISTS "notification_last_attempt_at",
  DROP COLUMN IF EXISTS "notification_lease_token",
  DROP COLUMN IF EXISTS "notification_lease_expires_at",
  DROP COLUMN IF EXISTS "notification_sent_at",
  DROP COLUMN IF EXISTS "notification_provider_id",
  DROP COLUMN IF EXISTS "notification_error";
DROP TYPE IF EXISTS "public"."enum_feedback_submissions_notification_status";
ALTER TABLE "site_settings"
  DROP COLUMN IF EXISTS "feedback_notification_recipient";
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(SITE_FEEDBACK_EMAIL_NOTIFICATIONS_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(SITE_FEEDBACK_EMAIL_NOTIFICATIONS_DOWN_SQL))
}
