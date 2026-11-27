import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export const GIVING_CAMPAIGN_ALLOCATIONS_UP_SQL = `
CREATE TABLE IF NOT EXISTS giving_checkout_allocations (
  checkout_id integer NOT NULL REFERENCES giving_checkouts(id) ON DELETE RESTRICT,
  opportunity_id varchar NOT NULL CHECK(opportunity_id IN ('plant','train','grow','build','greatest-need')),
  fund_name varchar NOT NULL, reference varchar NOT NULL, gl_code varchar NOT NULL,
  gl_name varchar NOT NULL, project varchar NOT NULL,
  amount_minor numeric NOT NULL CHECK(amount_minor>0 AND amount_minor<=9007199254740991 AND amount_minor=trunc(amount_minor) AND mod(amount_minor,100)=0),
  PRIMARY KEY(checkout_id,opportunity_id)
);
`
export async function up({ db }: MigrateUpArgs) { await db.execute(sql.raw(GIVING_CAMPAIGN_ALLOCATIONS_UP_SQL)) }
export async function down(_args: MigrateDownArgs) { throw new Error('Allocation history requires a forward migration') }
