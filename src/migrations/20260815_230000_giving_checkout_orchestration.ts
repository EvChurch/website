import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const GIVING_CHECKOUT_ORCHESTRATION_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '60s';
ALTER TABLE giving_checkouts
  ALTER COLUMN first_payment_date TYPE date USING (first_payment_date AT TIME ZONE 'Pacific/Auckland')::date,
  ADD COLUMN IF NOT EXISTS submission_key_digest varchar,
  ADD COLUMN IF NOT EXISTS submission_digest varchar,
  ADD COLUMN IF NOT EXISTS return_capability_digest varchar,
  ADD COLUMN IF NOT EXISTS return_capability_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS return_capability_consumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_capability_digest varchar,
  ADD COLUMN IF NOT EXISTS status_capability_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_binding_digest varchar,
  ADD COLUMN IF NOT EXISTS gateway_redirect_uri varchar,
  ADD COLUMN IF NOT EXISTS result_code varchar;
DROP INDEX IF EXISTS giving_checkouts_submission_digest_unique;
CREATE UNIQUE INDEX IF NOT EXISTS giving_checkouts_submission_key_digest_unique ON giving_checkouts(submission_key_digest) WHERE submission_key_digest IS NOT NULL;
CREATE INDEX IF NOT EXISTS giving_checkouts_submission_digest_idx ON giving_checkouts(submission_digest) WHERE submission_digest IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS giving_checkouts_return_capability_unique ON giving_checkouts(return_capability_digest) WHERE return_capability_digest IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS giving_checkouts_status_capability_unique ON giving_checkouts(status_capability_digest) WHERE status_capability_digest IS NOT NULL;
ALTER TABLE giving_checkouts DROP CONSTRAINT IF EXISTS giving_checkouts_capability_shape;
ALTER TABLE giving_checkouts ADD CONSTRAINT giving_checkouts_capability_shape CHECK (
  (return_capability_digest IS NULL AND return_capability_expires_at IS NULL AND return_capability_consumed_at IS NULL)
  OR (return_capability_digest IS NOT NULL AND return_capability_expires_at IS NOT NULL)
);

ALTER TABLE giving_provider_operations
  ADD COLUMN IF NOT EXISTS request_id varchar,
  ADD COLUMN IF NOT EXISTS idempotency_key varchar;
CREATE UNIQUE INDEX IF NOT EXISTS giving_provider_operations_request_id_unique ON giving_provider_operations(provider,environment,request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS giving_provider_operations_idempotency_key_unique ON giving_provider_operations(provider,environment,idempotency_key) WHERE idempotency_key IS NOT NULL;
ALTER TABLE giving_provider_operations DROP CONSTRAINT IF EXISTS giving_provider_operations_blinkpay_keys;
ALTER TABLE giving_provider_operations ADD CONSTRAINT giving_provider_operations_blinkpay_keys CHECK (
  provider <> 'blinkpay' OR (request_id IS NOT NULL AND idempotency_key IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS giving_consents_checkout_unique ON giving_consents(checkout_id);
CREATE UNIQUE INDEX IF NOT EXISTS giving_schedules_checkout_unique ON giving_schedules(checkout_id);

CREATE TABLE IF NOT EXISTS giving_checkout_rate_limits (
  id bigserial PRIMARY KEY,
  bucket_digest varchar NOT NULL,
  scope varchar NOT NULL CHECK(scope IN ('client','identity')),
  window_started_at timestamptz NOT NULL,
  count integer NOT NULL CHECK(count > 0),
  expires_at timestamptz NOT NULL,
  UNIQUE(bucket_digest,scope,window_started_at)
);
CREATE INDEX IF NOT EXISTS giving_checkout_rate_limits_expiry_idx ON giving_checkout_rate_limits(expires_at);
`

export const GIVING_CHECKOUT_ORCHESTRATION_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '60s';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM giving_checkouts WHERE submission_key_digest IS NOT NULL OR submission_digest IS NOT NULL OR return_capability_digest IS NOT NULL OR status_capability_digest IS NOT NULL)
    OR EXISTS(SELECT 1 FROM giving_provider_operations WHERE request_id IS NOT NULL OR idempotency_key IS NOT NULL)
  THEN RAISE EXCEPTION 'Cannot roll back giving checkout orchestration after checkout activity'; END IF;
END $$;
DROP TABLE IF EXISTS giving_checkout_rate_limits;
DROP INDEX IF EXISTS giving_schedules_checkout_unique;
DROP INDEX IF EXISTS giving_consents_checkout_unique;
ALTER TABLE giving_provider_operations DROP CONSTRAINT IF EXISTS giving_provider_operations_blinkpay_keys;
DROP INDEX IF EXISTS giving_provider_operations_idempotency_key_unique;
DROP INDEX IF EXISTS giving_provider_operations_request_id_unique;
ALTER TABLE giving_provider_operations DROP COLUMN IF EXISTS idempotency_key, DROP COLUMN IF EXISTS request_id;
ALTER TABLE giving_checkouts DROP CONSTRAINT IF EXISTS giving_checkouts_capability_shape;
DROP INDEX IF EXISTS giving_checkouts_status_capability_unique;
DROP INDEX IF EXISTS giving_checkouts_return_capability_unique;
DROP INDEX IF EXISTS giving_checkouts_submission_digest_idx;
DROP INDEX IF EXISTS giving_checkouts_submission_key_digest_unique;
ALTER TABLE giving_checkouts
  DROP COLUMN IF EXISTS status_binding_digest,
  DROP COLUMN IF EXISTS status_capability_expires_at,
  DROP COLUMN IF EXISTS status_capability_digest,
  DROP COLUMN IF EXISTS return_capability_consumed_at,
  DROP COLUMN IF EXISTS return_capability_expires_at,
  DROP COLUMN IF EXISTS return_capability_digest,
  DROP COLUMN IF EXISTS result_code,
  DROP COLUMN IF EXISTS gateway_redirect_uri,
  DROP COLUMN IF EXISTS submission_digest,
  DROP COLUMN IF EXISTS submission_key_digest,
  ALTER COLUMN first_payment_date TYPE timestamptz USING first_payment_date::timestamp AT TIME ZONE 'Pacific/Auckland';
`

export async function up({ db }: MigrateUpArgs) { await db.execute(sql.raw(GIVING_CHECKOUT_ORCHESTRATION_UP_SQL)) }
export async function down({ db }: MigrateDownArgs) { await db.execute(sql.raw(GIVING_CHECKOUT_ORCHESTRATION_DOWN_SQL)) }
