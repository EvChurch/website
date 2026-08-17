import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const GIVING_BANK_CODE_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '60s';
ALTER TABLE giving_checkouts ADD COLUMN IF NOT EXISTS bank_code varchar;
UPDATE giving_checkouts SET bank_code='GIVER' WHERE bank_code IS NULL;
ALTER TABLE giving_checkouts DROP CONSTRAINT IF EXISTS giving_checkouts_bank_code_valid;
ALTER TABLE giving_checkouts ADD CONSTRAINT giving_checkouts_bank_code_valid CHECK(bank_code ~ '^[A-Z0-9]{1,12}$');
ALTER TABLE giving_checkouts ALTER COLUMN bank_code SET NOT NULL;
`

export const GIVING_BANK_CODE_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '60s';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM giving_checkouts LIMIT 1) THEN
    RAISE EXCEPTION 'Cannot roll back giving bank code after checkout activity';
  END IF;
END $$;
ALTER TABLE giving_checkouts DROP CONSTRAINT IF EXISTS giving_checkouts_bank_code_valid;
ALTER TABLE giving_checkouts DROP COLUMN IF EXISTS bank_code;
`

export async function up({ db }: MigrateUpArgs) { await db.execute(sql.raw(GIVING_BANK_CODE_UP_SQL)) }
export async function down({ db }: MigrateDownArgs) { await db.execute(sql.raw(GIVING_BANK_CODE_DOWN_SQL)) }
