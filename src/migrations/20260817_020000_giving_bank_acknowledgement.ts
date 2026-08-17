import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const GIVING_BANK_ACKNOWLEDGEMENT_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '60s';
ALTER TABLE giving_checkouts ADD COLUMN IF NOT EXISTS bank_setup_acknowledged_at timestamptz;
`

export const GIVING_BANK_ACKNOWLEDGEMENT_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '60s';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM giving_checkouts WHERE bank_setup_acknowledged_at IS NOT NULL LIMIT 1) THEN
    RAISE EXCEPTION 'Cannot roll back giving bank acknowledgement after acknowledgement activity';
  END IF;
END $$;
ALTER TABLE giving_checkouts DROP COLUMN IF EXISTS bank_setup_acknowledged_at;
`

export async function up({ db }: MigrateUpArgs) { await db.execute(sql.raw(GIVING_BANK_ACKNOWLEDGEMENT_UP_SQL)) }
export async function down({ db }: MigrateDownArgs) { await db.execute(sql.raw(GIVING_BANK_ACKNOWLEDGEMENT_DOWN_SQL)) }
