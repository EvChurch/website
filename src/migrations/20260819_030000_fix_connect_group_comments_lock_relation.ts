import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "connect_group_comments_id" integer;
DO $$ BEGIN
  ALTER TABLE "payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_connect_group_comments_fk"
    FOREIGN KEY ("connect_group_comments_id")
    REFERENCES "public"."connect_group_comments"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_connect_group_comments_id_idx"
  ON "payload_locked_documents_rels" USING btree ("connect_group_comments_id");
`

export const FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_DOWN_SQL = String.raw`
DROP INDEX IF EXISTS "payload_locked_documents_rels_connect_group_comments_id_idx";
ALTER TABLE "payload_locked_documents_rels"
  DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_connect_group_comments_fk";
ALTER TABLE "payload_locked_documents_rels"
  DROP COLUMN IF EXISTS "connect_group_comments_id";
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_DOWN_SQL))
}
