import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export const ATTENDANCE_SAVE_REQUESTS_SQL = String.raw`
    CREATE TABLE attendance_save_requests (
      request_id uuid PRIMARY KEY,
      meeting_key text NOT NULL,
      fingerprint text NOT NULL,
      target jsonb NOT NULL,
      retry_safe boolean NOT NULL DEFAULT false,
      completed boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX attendance_save_requests_pending ON attendance_save_requests (meeting_key) WHERE NOT completed;
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(ATTENDANCE_SAVE_REQUESTS_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE attendance_save_requests`)
}
