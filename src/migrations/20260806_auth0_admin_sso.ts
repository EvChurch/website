import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const AUTH0_ADMIN_SSO_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "users") THEN
    RAISE EXCEPTION 'Auth0 admin SSO requires zero existing Payload users; run the verified disposable-user cleanup first';
  END IF;
END $$;

ALTER TABLE "users"
  ADD COLUMN "auth0_identity_key" varchar NOT NULL,
  ADD COLUMN "auth0_issuer" varchar NOT NULL,
  ADD COLUMN "auth0_subject" varchar NOT NULL;

CREATE UNIQUE INDEX "users_auth0_identity_key_idx"
  ON "users" USING btree ("auth0_identity_key");
CREATE UNIQUE INDEX "users_roles_parent_value_unique"
  ON "users_roles" USING btree ("parent_id", "value");

DROP TABLE IF EXISTS "users_sessions";
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "reset_password_token",
  DROP COLUMN IF EXISTS "reset_password_expiration",
  DROP COLUMN IF EXISTS "salt",
  DROP COLUMN IF EXISTS "hash",
  DROP COLUMN IF EXISTS "login_attempts",
  DROP COLUMN IF EXISTS "lock_until";
`

export const AUTH0_ADMIN_SSO_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "users") THEN
    RAISE EXCEPTION 'Cannot restore local authentication while Auth0 users exist; user credentials cannot be reconstructed';
  END IF;
END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "reset_password_token" varchar,
  ADD COLUMN IF NOT EXISTS "reset_password_expiration" timestamp(3) with time zone,
  ADD COLUMN IF NOT EXISTS "salt" varchar,
  ADD COLUMN IF NOT EXISTS "hash" varchar,
  ADD COLUMN IF NOT EXISTS "login_attempts" numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lock_until" timestamp(3) with time zone;

CREATE TABLE IF NOT EXISTS "users_sessions" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "created_at" timestamp(3) with time zone,
  "expires_at" timestamp(3) with time zone NOT NULL,
  CONSTRAINT "users_sessions_parent_id_fk"
    FOREIGN KEY ("_parent_id") REFERENCES "users"("id") ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");

DROP INDEX IF EXISTS "users_roles_parent_value_unique";
DROP INDEX IF EXISTS "users_auth0_identity_key_idx";
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "auth0_identity_key",
  DROP COLUMN IF EXISTS "auth0_issuer",
  DROP COLUMN IF EXISTS "auth0_subject";
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(AUTH0_ADMIN_SSO_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(AUTH0_ADMIN_SSO_DOWN_SQL))
}
