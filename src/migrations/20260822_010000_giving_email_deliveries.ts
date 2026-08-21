import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const GIVING_EMAIL_DELIVERIES_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE giving_checkouts
  ADD COLUMN IF NOT EXISTS bank_details_prepared_at timestamptz;

CREATE TABLE IF NOT EXISTS giving_email_deliveries (
  id bigserial PRIMARY KEY,
  checkout_id integer NOT NULL REFERENCES giving_checkouts(id) ON DELETE RESTRICT,
  kind varchar NOT NULL CHECK (kind IN ('bank-transfer-details','bank-transfer-thanks','blinkpay-thanks')),
  status varchar NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  provider_id varchar,
  error_code varchar,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(checkout_id, kind)
);

CREATE INDEX IF NOT EXISTS giving_email_deliveries_status_idx
  ON giving_email_deliveries(status, created_at);
CREATE INDEX IF NOT EXISTS giving_email_deliveries_lease_idx
  ON giving_email_deliveries(lease_expires_at)
  WHERE status='sending';

DO $$ BEGIN
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE IF NOT EXISTS 'sendGivingEmail';
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE IF NOT EXISTS 'reconcileGivingEmails';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE IF NOT EXISTS 'sendGivingEmail';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE IF NOT EXISTS 'reconcileGivingEmails';
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;
`

export const GIVING_EMAIL_DELIVERIES_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM giving_email_deliveries LIMIT 1)
    OR EXISTS(SELECT 1 FROM giving_checkouts WHERE bank_details_prepared_at IS NOT NULL LIMIT 1) THEN
    RAISE EXCEPTION 'Cannot roll back giving email deliveries after giving email data exists';
  END IF;
END $$;
DROP INDEX IF EXISTS giving_email_deliveries_lease_idx;
DROP INDEX IF EXISTS giving_email_deliveries_status_idx;
DROP TABLE IF EXISTS giving_email_deliveries;
ALTER TABLE giving_checkouts DROP COLUMN IF EXISTS bank_details_prepared_at;
`

export async function up({ db }: MigrateUpArgs) { await db.execute(sql.raw(GIVING_EMAIL_DELIVERIES_UP_SQL)) }
export async function down({ db }: MigrateDownArgs) { await db.execute(sql.raw(GIVING_EMAIL_DELIVERIES_DOWN_SQL)) }
