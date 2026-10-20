import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Schema only: Rock sync populates the confirmed schedule after deployment.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS scheduled_occurrences jsonb`)
}

// Preserve source schedule data when rolling back the application.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`SELECT 1`)
}
