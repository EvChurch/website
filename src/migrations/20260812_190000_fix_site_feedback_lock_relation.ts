import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const FIX_SITE_FEEDBACK_LOCK_RELATION_UP_SQL = String.raw`
ALTER TABLE "payload_locked_documents_rels"
  ADD COLUMN "feedback_submissions_id" integer;
ALTER TABLE "payload_locked_documents_rels"
  ADD CONSTRAINT "payload_locked_documents_rels_feedback_submissions_fk"
  FOREIGN KEY ("feedback_submissions_id")
  REFERENCES "public"."feedback_submissions"("id")
  ON DELETE cascade ON UPDATE no action;
CREATE INDEX "payload_locked_documents_rels_feedback_submissions_id_idx"
  ON "payload_locked_documents_rels" USING btree ("feedback_submissions_id");
`

export const FIX_SITE_FEEDBACK_LOCK_RELATION_DOWN_SQL = String.raw`
DROP INDEX IF EXISTS "payload_locked_documents_rels_feedback_submissions_id_idx";
ALTER TABLE "payload_locked_documents_rels"
  DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_feedback_submissions_fk";
ALTER TABLE "payload_locked_documents_rels"
  DROP COLUMN IF EXISTS "feedback_submissions_id";
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(FIX_SITE_FEEDBACK_LOCK_RELATION_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(FIX_SITE_FEEDBACK_LOCK_RELATION_DOWN_SQL))
}
