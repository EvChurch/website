import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

// Schema only. Event content is written through Payload after this field is
// deployed; migrations must never target or rewrite individual events.
export const EVENT_WEBSITE_SUMMARY_UP_SQL = `
  ALTER TABLE events
    ADD COLUMN IF NOT EXISTS website_summary jsonb;
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(EVENT_WEBSITE_SUMMARY_UP_SQL))
}

// Retain editor-owned content if an older application version is rolled back.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`SELECT 1`)
}
