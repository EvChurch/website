import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const GIVING_DRAFTS_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '30s';
CREATE TABLE IF NOT EXISTS "giving_drafts" (
  "id" serial PRIMARY KEY,
  "token_digest" varchar NOT NULL UNIQUE,
  "binding_digest" varchar NOT NULL,
  "purpose" varchar NOT NULL CHECK (purpose IN ('giving-draft-resume-v1','giving-draft-session-v1')),
  "audience" varchar NOT NULL CHECK (audience IN ('guest','member')),
  "answers" jsonb NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "giving_drafts_binding_idx" ON "giving_drafts" ("binding_digest");
CREATE INDEX IF NOT EXISTS "giving_drafts_expires_at_idx" ON "giving_drafts" ("expires_at");
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "giving_drafts_id" integer;
DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_giving_drafts_fk" FOREIGN KEY ("giving_drafts_id") REFERENCES "giving_drafts"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_giving_drafts_id_idx" ON "payload_locked_documents_rels" ("giving_drafts_id");
`

export const GIVING_DRAFTS_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '30s';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM "giving_drafts") THEN RAISE EXCEPTION 'Cannot roll back while giving drafts exist'; END IF; END $$;
DROP INDEX IF EXISTS "payload_locked_documents_rels_giving_drafts_id_idx";
ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_giving_drafts_fk";
ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "giving_drafts_id";
DROP TABLE IF EXISTS "giving_drafts";
`

export async function up({ db }: MigrateUpArgs) { await db.execute(sql.raw(GIVING_DRAFTS_UP_SQL)) }
export async function down({ db }: MigrateDownArgs) { await db.execute(sql.raw(GIVING_DRAFTS_DOWN_SQL)) }
