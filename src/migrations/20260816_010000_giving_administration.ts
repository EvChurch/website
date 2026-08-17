import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const GIVING_ADMINISTRATION_UP_SQL = String.raw`
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';

CREATE OR REPLACE FUNCTION giving_funds_serialize_default() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_default OR (TG_OP='UPDATE' AND OLD.is_default IS DISTINCT FROM NEW.is_default) THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('giving-funds-default',0));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS giving_funds_serialize_default ON giving_funds;
CREATE TRIGGER giving_funds_serialize_default BEFORE INSERT OR UPDATE OF is_default ON giving_funds FOR EACH ROW EXECUTE FUNCTION giving_funds_serialize_default();

DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM giving_funds WHERE active AND is_default)
     AND NOT EXISTS(SELECT 1 FROM giving_funds) THEN
    INSERT INTO giving_funds(name,code,accounting_key,description,active,is_default,sort_order)
    VALUES('General','GEN','general','General giving',true,true,0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS giving_cancellation_nonces (
  id bigserial PRIMARY KEY,
  token_digest varchar NOT NULL UNIQUE,
  actor_id integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  schedule_id integer NOT NULL REFERENCES giving_schedules(id) ON DELETE RESTRICT,
  reason_digest varchar NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT giving_cancellation_nonce_expiry_valid CHECK(expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS giving_cancellation_nonces_lookup_idx ON giving_cancellation_nonces(actor_id,schedule_id,expires_at) WHERE consumed_at IS NULL;

DO $$ BEGIN ALTER TABLE giving_schedules ADD CONSTRAINT giving_schedules_id_checkout_context_unique UNIQUE(id,checkout_id,context_key); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE giving_provider_operations
  ADD COLUMN IF NOT EXISTS schedule_id integer,
  ADD COLUMN IF NOT EXISTS actor_id integer REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS reason varchar;
DO $$ BEGIN ALTER TABLE giving_provider_operations ADD CONSTRAINT giving_provider_operations_schedule_provenance_fk FOREIGN KEY(schedule_id,checkout_id,context_key) REFERENCES giving_schedules(id,checkout_id,context_key) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE giving_provider_operations ADD CONSTRAINT giving_provider_cancel_audit_valid CHECK(
  action <> 'blinkpay.cancel-schedule' OR (schedule_id IS NOT NULL AND actor_id IS NOT NULL AND char_length(reason) BETWEEN 3 AND 500)
);
CREATE INDEX IF NOT EXISTS giving_provider_operations_schedule_idx ON giving_provider_operations(schedule_id) WHERE schedule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS giving_provider_operations_actor_idx ON giving_provider_operations(actor_id) WHERE actor_id IS NOT NULL;
`

export const GIVING_ADMINISTRATION_DOWN_SQL = String.raw`
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM giving_cancellation_nonces LIMIT 1)
     OR EXISTS(SELECT 1 FROM giving_provider_operations WHERE action='blinkpay.cancel-schedule' LIMIT 1) THEN
    RAISE EXCEPTION 'Cannot roll back giving administration after cancellation audit data exists';
  END IF;
END $$;
DELETE FROM giving_funds
WHERE name='General' AND code='GEN' AND accounting_key='general'
  AND description='General giving' AND active AND is_default AND sort_order=0
  AND (SELECT count(*) FROM giving_funds)=1
  AND NOT EXISTS(SELECT 1 FROM giving_givers)
  AND NOT EXISTS(SELECT 1 FROM giving_checkouts)
  AND NOT EXISTS(SELECT 1 FROM giving_gifts)
  AND NOT EXISTS(SELECT 1 FROM giving_consents)
  AND NOT EXISTS(SELECT 1 FROM giving_schedules)
  AND NOT EXISTS(SELECT 1 FROM giving_provider_operations)
  AND NOT EXISTS(SELECT 1 FROM blinkpay_webhook_events)
  AND NOT EXISTS(SELECT 1 FROM giving_drafts)
  AND NOT EXISTS(SELECT 1 FROM giving_checkout_rate_limits)
  AND NOT EXISTS(SELECT 1 FROM giving_cancellation_nonces);
DROP INDEX IF EXISTS giving_provider_operations_actor_idx;
DROP INDEX IF EXISTS giving_provider_operations_schedule_idx;
ALTER TABLE giving_provider_operations DROP CONSTRAINT IF EXISTS giving_provider_cancel_audit_valid;
ALTER TABLE giving_provider_operations DROP CONSTRAINT IF EXISTS giving_provider_operations_schedule_provenance_fk;
ALTER TABLE giving_provider_operations DROP COLUMN IF EXISTS reason, DROP COLUMN IF EXISTS actor_id, DROP COLUMN IF EXISTS schedule_id;
DROP TABLE IF EXISTS giving_cancellation_nonces;
ALTER TABLE giving_schedules DROP CONSTRAINT IF EXISTS giving_schedules_id_checkout_context_unique;
DROP TRIGGER IF EXISTS giving_funds_serialize_default ON giving_funds;
DROP FUNCTION IF EXISTS giving_funds_serialize_default();
`

export async function up({ db }: MigrateUpArgs) { await db.execute(sql.raw(GIVING_ADMINISTRATION_UP_SQL)) }
export async function down({ db }: MigrateDownArgs) { await db.execute(sql.raw(GIVING_ADMINISTRATION_DOWN_SQL)) }
