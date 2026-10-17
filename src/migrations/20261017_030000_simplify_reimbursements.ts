import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export const SIMPLIFY_REIMBURSEMENTS_UP_SQL = String.raw`
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
ALTER TABLE reimbursement_reports
 DROP COLUMN IF EXISTS title,
 DROP COLUMN IF EXISTS payment_batch,
 DROP COLUMN IF EXISTS payment_date,
 DROP COLUMN IF EXISTS payment_reference;
ALTER TABLE reimbursement_categories DROP COLUMN IF EXISTS account_code;
UPDATE reimbursement_reports r SET
 lines=COALESCE((SELECT jsonb_agg(line - 'accountCode' ORDER BY position)
   FROM jsonb_array_elements(r.lines) WITH ORDINALITY AS entries(line,position)), '[]'::jsonb),
 history=COALESCE((SELECT jsonb_agg(
   (CASE WHEN entry->>'action'='paid' THEN jsonb_set(entry,'{reason}','""'::jsonb) ELSE entry END)
   || CASE WHEN entry ? 'snapshot' THEN jsonb_build_object('snapshot',
     ((entry->'snapshot') - 'title') || CASE WHEN jsonb_typeof(entry->'snapshot'->'lines')='array'
       THEN jsonb_build_object('lines',COALESCE((SELECT jsonb_agg(line - 'accountCode' ORDER BY line_position)
         FROM jsonb_array_elements(entry->'snapshot'->'lines') WITH ORDINALITY AS snapshot_lines(line,line_position)), '[]'::jsonb))
       ELSE '{}'::jsonb END) ELSE '{}'::jsonb END ORDER BY position)
   FROM jsonb_array_elements(r.history) WITH ORDINALITY AS entries(entry,position)), '[]'::jsonb);
-- Invalidate unsent legacy payment notices.
UPDATE reimbursement_email_deliveries SET state='cancelled',body='',payload=NULL,lease_until=NULL,lease_token=NULL
 WHERE state<>'sent' AND (kind LIKE 'paid-%' OR kind LIKE 'payment-correction-%');
`
export async function up({ db }: MigrateUpArgs) { await db.execute(sql.raw(SIMPLIFY_REIMBURSEMENTS_UP_SQL)) }
export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql`DO $$ BEGIN RAISE EXCEPTION 'Removed reimbursement fields cannot be restored. Use a reviewed rollback.'; END $$;`)
}
