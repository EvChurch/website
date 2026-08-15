import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const GIVING_WEBHOOK_JOB_SLUGS = ['processBlinkPayWebhookEvent', 'reconcileGivingLifecycle'] as const

export const GIVING_WEBHOOK_JOBS_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '60s';
ALTER TABLE giving_gifts DROP CONSTRAINT IF EXISTS giving_gifts_checkout_unique;
DO $$ BEGIN ALTER TABLE giving_schedules ADD CONSTRAINT giving_schedules_id_context_unique UNIQUE(id,context_key); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE giving_gifts ADD COLUMN IF NOT EXISTS consent_id integer, ADD COLUMN IF NOT EXISTS schedule_id integer, ADD COLUMN IF NOT EXISTS provider_status varchar, ADD COLUMN IF NOT EXISTS provider_status_updated_at timestamptz, ADD COLUMN IF NOT EXISTS provider_verified_at timestamptz, ADD COLUMN IF NOT EXISTS provider_source varchar;
DO $$ BEGIN ALTER TABLE giving_gifts ADD CONSTRAINT giving_gifts_consent_context_fk FOREIGN KEY(consent_id,context_key) REFERENCES giving_consents(id,context_key) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE giving_gifts ADD CONSTRAINT giving_gifts_schedule_context_fk FOREIGN KEY(schedule_id,context_key) REFERENCES giving_schedules(id,context_key) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE giving_gifts DROP CONSTRAINT IF EXISTS giving_gifts_status_valid;
ALTER TABLE giving_gifts ADD CONSTRAINT giving_gifts_status_valid CHECK(status IN ('pending','settled','failed','cancelled'));
ALTER TABLE giving_consents ADD COLUMN IF NOT EXISTS provider_status varchar, ADD COLUMN IF NOT EXISTS provider_status_updated_at timestamptz, ADD COLUMN IF NOT EXISTS provider_verified_at timestamptz, ADD COLUMN IF NOT EXISTS provider_source varchar;
ALTER TABLE giving_consents DROP CONSTRAINT IF EXISTS giving_consents_status_valid;
ALTER TABLE giving_consents ADD CONSTRAINT giving_consents_status_valid CHECK(status IN ('pending','authorised','revoked','expired','failed'));
ALTER TABLE giving_schedules ADD COLUMN IF NOT EXISTS provider_status varchar, ADD COLUMN IF NOT EXISTS provider_status_updated_at timestamptz, ADD COLUMN IF NOT EXISTS provider_verified_at timestamptz, ADD COLUMN IF NOT EXISTS provider_source varchar;
ALTER TABLE blinkpay_webhook_events ADD COLUMN IF NOT EXISTS last_conflicting_digest varchar, ADD COLUMN IF NOT EXISTS provider_reference_type varchar, ADD COLUMN IF NOT EXISTS provider_reference_id varchar;
ALTER TABLE blinkpay_webhook_events DROP CONSTRAINT IF EXISTS blinkpay_webhook_events_attempt_count_valid;
ALTER TABLE blinkpay_webhook_events DROP CONSTRAINT IF EXISTS blinkpay_webhook_events_duplicate_count_valid;
ALTER TABLE blinkpay_webhook_events DROP CONSTRAINT IF EXISTS blinkpay_webhook_events_conflict_count_valid;
ALTER TABLE blinkpay_webhook_events ADD CONSTRAINT blinkpay_webhook_events_attempt_count_valid CHECK(attempt_count >= 0 AND attempt_count=trunc(attempt_count));
ALTER TABLE blinkpay_webhook_events ADD CONSTRAINT blinkpay_webhook_events_duplicate_count_valid CHECK(duplicate_count >= 0 AND duplicate_count=trunc(duplicate_count));
ALTER TABLE blinkpay_webhook_events ADD CONSTRAINT blinkpay_webhook_events_conflict_count_valid CHECK(conflict_count >= 0 AND conflict_count=trunc(conflict_count));
ALTER TABLE blinkpay_webhook_events DROP CONSTRAINT IF EXISTS blinkpay_webhook_events_provenance_valid;
ALTER TABLE blinkpay_webhook_events ADD CONSTRAINT blinkpay_webhook_events_provenance_valid CHECK((environment='production' AND NOT synthetic AND e2e_run_id IS NULL AND context_key='production') OR (environment='sandbox' AND synthetic AND e2e_run_id IS NOT NULL) OR (environment='sandbox' AND synthetic AND e2e_run_id IS NULL AND context_key='sandbox:unmatched' AND status='quarantined') OR (environment='production' AND NOT synthetic AND e2e_run_id IS NULL AND context_key='production:unmatched' AND status='quarantined'));
DO $$ BEGIN
  ALTER TYPE public.enum_payload_jobs_log_task_slug ADD VALUE IF NOT EXISTS 'processBlinkPayWebhookEvent';
  ALTER TYPE public.enum_payload_jobs_log_task_slug ADD VALUE IF NOT EXISTS 'reconcileGivingLifecycle';
  ALTER TYPE public.enum_payload_jobs_task_slug ADD VALUE IF NOT EXISTS 'processBlinkPayWebhookEvent';
  ALTER TYPE public.enum_payload_jobs_task_slug ADD VALUE IF NOT EXISTS 'reconcileGivingLifecycle';
EXCEPTION WHEN undefined_object THEN NULL; END $$;
`

// Payload job enum values are shared durable history. They intentionally remain on down.
export const GIVING_WEBHOOK_JOBS_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '60s';
DO $$ BEGIN IF EXISTS(SELECT 1 FROM blinkpay_webhook_events WHERE provider_reference_id IS NOT NULL) OR EXISTS(SELECT 1 FROM giving_gifts WHERE consent_id IS NOT NULL OR schedule_id IS NOT NULL) OR EXISTS(SELECT checkout_id FROM giving_gifts GROUP BY checkout_id HAVING count(*)>1) THEN RAISE EXCEPTION 'Cannot roll back giving webhook lifecycle after lifecycle activity'; END IF; END $$;
ALTER TABLE blinkpay_webhook_events DROP CONSTRAINT IF EXISTS blinkpay_webhook_events_provenance_valid;
ALTER TABLE blinkpay_webhook_events ADD CONSTRAINT blinkpay_webhook_events_provenance_valid CHECK((environment='production' AND NOT synthetic AND e2e_run_id IS NULL AND context_key='production') OR (environment='sandbox' AND synthetic AND e2e_run_id IS NOT NULL));
ALTER TABLE blinkpay_webhook_events DROP CONSTRAINT IF EXISTS blinkpay_webhook_events_attempt_count_valid;
ALTER TABLE blinkpay_webhook_events DROP CONSTRAINT IF EXISTS blinkpay_webhook_events_duplicate_count_valid;
ALTER TABLE blinkpay_webhook_events DROP CONSTRAINT IF EXISTS blinkpay_webhook_events_conflict_count_valid;
ALTER TABLE blinkpay_webhook_events DROP COLUMN IF EXISTS provider_reference_id, DROP COLUMN IF EXISTS provider_reference_type, DROP COLUMN IF EXISTS last_conflicting_digest;
ALTER TABLE giving_schedules DROP COLUMN IF EXISTS provider_source, DROP COLUMN IF EXISTS provider_verified_at, DROP COLUMN IF EXISTS provider_status_updated_at, DROP COLUMN IF EXISTS provider_status;
ALTER TABLE giving_consents DROP CONSTRAINT IF EXISTS giving_consents_status_valid;
ALTER TABLE giving_consents DROP COLUMN IF EXISTS provider_source, DROP COLUMN IF EXISTS provider_verified_at, DROP COLUMN IF EXISTS provider_status_updated_at, DROP COLUMN IF EXISTS provider_status;
ALTER TABLE giving_gifts DROP CONSTRAINT IF EXISTS giving_gifts_schedule_context_fk;
ALTER TABLE giving_gifts DROP CONSTRAINT IF EXISTS giving_gifts_consent_context_fk;
ALTER TABLE giving_gifts DROP CONSTRAINT IF EXISTS giving_gifts_status_valid;
ALTER TABLE giving_gifts DROP COLUMN IF EXISTS provider_source, DROP COLUMN IF EXISTS provider_verified_at, DROP COLUMN IF EXISTS provider_status_updated_at, DROP COLUMN IF EXISTS provider_status, DROP COLUMN IF EXISTS schedule_id, DROP COLUMN IF EXISTS consent_id;
ALTER TABLE giving_gifts ADD CONSTRAINT giving_gifts_checkout_unique UNIQUE(checkout_id);
ALTER TABLE giving_schedules DROP CONSTRAINT IF EXISTS giving_schedules_id_context_unique;
`

export async function up({ db }: MigrateUpArgs) { await db.execute(sql.raw(GIVING_WEBHOOK_JOBS_UP_SQL)) }
export async function down({ db }: MigrateDownArgs) { await db.execute(sql.raw(GIVING_WEBHOOK_JOBS_DOWN_SQL)) }
