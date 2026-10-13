import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const FEEDBACK_GITHUB_ISSUE_LINKS_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "feedback_submissions"
  ADD COLUMN IF NOT EXISTS "github_issue_number" numeric,
  ADD COLUMN IF NOT EXISTS "github_issue_url" varchar;

CREATE INDEX IF NOT EXISTS "feedback_submissions_github_issue_number_idx"
  ON "feedback_submissions" USING btree ("github_issue_number");
`

export const FEEDBACK_GITHUB_ISSUE_LINKS_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP INDEX IF EXISTS "feedback_submissions_github_issue_number_idx";

ALTER TABLE "feedback_submissions"
  DROP COLUMN IF EXISTS "github_issue_url",
  DROP COLUMN IF EXISTS "github_issue_number";
`

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql.raw(FEEDBACK_GITHUB_ISSUE_LINKS_UP_SQL))
}

export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql.raw(FEEDBACK_GITHUB_ISSUE_LINKS_DOWN_SQL))
}
