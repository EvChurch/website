import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export const API_UP_SQL = String.raw`
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE IF NOT EXISTS api_keys (
  id varchar PRIMARY KEY, name varchar NOT NULL, person_id numeric NOT NULL,
  person_name varchar, person_email varchar, secret_hash varchar,
  scopes jsonb NOT NULL, no_expiry boolean DEFAULT false, expires_at timestamp(3) with time zone,
  revoked boolean DEFAULT false, revoked_at timestamp(3) with time zone,
  generated_at timestamp(3) with time zone, created_at timestamp(3) with time zone NOT NULL DEFAULT now(),
  updated_at timestamp(3) with time zone NOT NULL DEFAULT now(), last_used_at timestamp(3) with time zone,
  rate_window timestamp(3) with time zone DEFAULT now(), rate_count numeric DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_secret_hash_idx ON api_keys(secret_hash);
CREATE INDEX IF NOT EXISTS api_keys_created_at_idx ON api_keys(created_at);
CREATE INDEX IF NOT EXISTS api_keys_updated_at_idx ON api_keys(updated_at);
CREATE TABLE IF NOT EXISTS api_operations (
  key_id varchar NOT NULL REFERENCES api_keys(id), operation_id text NOT NULL,
  request_hash text NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(key_id,operation_id)
);
CREATE TABLE IF NOT EXISTS api_audit (
  id serial PRIMARY KEY, key_id varchar, admin_id numeric, action varchar NOT NULL, status numeric NOT NULL,
  details jsonb, created_at timestamp(3) with time zone NOT NULL DEFAULT now(), updated_at timestamp(3) with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_audit_created_at_idx ON api_audit(created_at);
CREATE INDEX IF NOT EXISTS api_audit_updated_at_idx ON api_audit(updated_at);
-- Prevent stale admin form saves from undoing revocation or overwriting a generated secret.
CREATE OR REPLACE FUNCTION protect_api_key_credential() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.revoked_at IS NOT NULL THEN NEW.revoked_at := OLD.revoked_at; NEW.revoked := true; END IF;
 IF OLD.secret_hash IS NOT NULL AND NEW.secret_hash IS DISTINCT FROM OLD.secret_hash THEN
   RAISE EXCEPTION 'An issued API credential cannot be replaced';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_api_key_credential ON api_keys;
CREATE TRIGGER protect_api_key_credential BEFORE UPDATE ON api_keys FOR EACH ROW EXECUTE FUNCTION protect_api_key_credential();
`
export async function up({db}: MigrateUpArgs) {
  await db.execute(sql.raw(API_UP_SQL))
  await db.execute(sql`ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS api_keys_id varchar;
    ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS api_audit_id integer;
    CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_api_keys_id_idx ON payload_locked_documents_rels(api_keys_id);
    CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_api_audit_id_idx ON payload_locked_documents_rels(api_audit_id);`)
}
export async function down({db}: MigrateDownArgs) {
  await db.execute(sql`DO $$ BEGIN RAISE EXCEPTION 'API credentials and audit history require a reviewed data-preserving rollback.'; END $$;`)
}
