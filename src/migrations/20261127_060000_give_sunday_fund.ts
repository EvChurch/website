import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// This is a checkout grouping key, not a Xero GL mapping. Finance uses the
// immutable per-opportunity mappings in the companion allocation export.
export const GIVE_SUNDAY_FUND_UP_SQL = `
INSERT INTO giving_funds(name,code,accounting_key,description,active,is_default,sort_order)
VALUES ('Give Sunday','GIVESUNDAY26','GIVESUNDAY26:ALLOCATIONS',
  'One-off Give Sunday gifts. Reconcile using the companion allocation export for each opportunity reference, GL code and project.',
  true,false,100)
ON CONFLICT(code) DO NOTHING;
`

export async function up({ db }: MigrateUpArgs) { await db.execute(sql.raw(GIVE_SUNDAY_FUND_UP_SQL)) }
export async function down(_args: MigrateDownArgs) { throw new Error('Giving funds with payment history require a forward migration') }
