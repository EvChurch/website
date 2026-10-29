import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export const REIMBURSEMENT_CAMPUS_UP_SQL = String.raw`
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
ALTER TABLE reimbursement_reports
  ADD COLUMN IF NOT EXISTS campus_id integer,
  ADD COLUMN IF NOT EXISTS campus_name text NOT NULL DEFAULT '';
`

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql.raw(REIMBURSEMENT_CAMPUS_UP_SQL))
}

export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql`DO $$ BEGIN RAISE EXCEPTION 'Reimbursement campuses contain financial history. Use a reviewed data-preserving rollback.'; END $$;`)
}
