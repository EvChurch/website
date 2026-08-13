import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const LEADER_RESOURCE_SHARES_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS "leader_resource_shares" (
  "id" serial PRIMARY KEY,
  "token" varchar NOT NULL,
  "pair_key" varchar NOT NULL,
  "resource_rock_id" numeric NOT NULL,
  "sharer_rock_person_id" numeric NOT NULL,
  "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "leader_resource_shares_token_unique" UNIQUE ("token"),
  CONSTRAINT "leader_resource_shares_pair_key_unique" UNIQUE ("pair_key"),
  CONSTRAINT "leader_resource_shares_resource_sharer_unique" UNIQUE ("resource_rock_id", "sharer_rock_person_id")
);
CREATE INDEX IF NOT EXISTS "leader_resource_shares_resource_rock_id_idx" ON "leader_resource_shares" ("resource_rock_id");
CREATE INDEX IF NOT EXISTS "leader_resource_shares_sharer_rock_person_id_idx" ON "leader_resource_shares" ("sharer_rock_person_id");
CREATE INDEX IF NOT EXISTS "leader_resource_shares_updated_at_idx" ON "leader_resource_shares" ("updated_at");
CREATE INDEX IF NOT EXISTS "leader_resource_shares_created_at_idx" ON "leader_resource_shares" ("created_at");
`

export const LEADER_RESOURCE_SHARES_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "leader_resource_shares") THEN
    RAISE EXCEPTION 'Cannot roll back while leader resource share links exist';
  END IF;
END $$;
DROP TABLE IF EXISTS "leader_resource_shares";
`

export async function up({ db }: MigrateUpArgs) { await db.execute(sql.raw(LEADER_RESOURCE_SHARES_UP_SQL)) }
export async function down({ db }: MigrateDownArgs) { await db.execute(sql.raw(LEADER_RESOURCE_SHARES_DOWN_SQL)) }
