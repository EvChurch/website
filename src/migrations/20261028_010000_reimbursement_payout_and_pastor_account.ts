import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export const REIMBURSEMENT_PAYOUT_AND_PASTOR_ACCOUNT_UP_SQL = String.raw`
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
ALTER TABLE responsibility_centres
  ALTER COLUMN rock_id DROP NOT NULL,
  ALTER COLUMN rock_guid DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS is_local boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS finance_only boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS responsibility_centres_local_name_idx
  ON responsibility_centres(name) WHERE is_local=true;
INSERT INTO responsibility_centres(name,is_local,finance_only,is_active,last_synced_at)
  VALUES('Pastor Expense Account',true,true,true,now())
  ON CONFLICT(name) WHERE is_local=true DO NOTHING;
ALTER TABLE reimbursement_reports ADD COLUMN IF NOT EXISTS payout_override jsonb;
`

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql.raw(REIMBURSEMENT_PAYOUT_AND_PASTOR_ACCOUNT_UP_SQL))
}

export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql`DO $$ BEGIN RAISE EXCEPTION 'Reimbursement purposes and payout overrides contain financial history. Use a reviewed data-preserving rollback.'; END $$;`)
}
