import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const FEEDBACK_POSTHOG_REPLAY_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "feedback_submissions"
  ADD COLUMN IF NOT EXISTS "post_hog_session_id" varchar,
  ADD COLUMN IF NOT EXISTS "post_hog_replay_url" varchar;
`

export const FEEDBACK_POSTHOG_REPLAY_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "feedback_submissions"
    WHERE "post_hog_session_id" IS NOT NULL
       OR "post_hog_replay_url" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot roll back feedback PostHog replay metadata while captured links exist';
  END IF;
END $$;

ALTER TABLE "feedback_submissions"
  DROP COLUMN IF EXISTS "post_hog_replay_url",
  DROP COLUMN IF EXISTS "post_hog_session_id";
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(FEEDBACK_POSTHOG_REPLAY_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(FEEDBACK_POSTHOG_REPLAY_DOWN_SQL))
}
