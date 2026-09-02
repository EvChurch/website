import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const GIVING_TRANSACTION_FEES_UP_SQL = String.raw`
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';
CREATE TABLE IF NOT EXISTS "giving_settings" (
  "id" serial PRIMARY KEY,
  "transaction_fee_minor" numeric NOT NULL DEFAULT 50,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT giving_settings_transaction_fee_minor_nonnegative_integer
    CHECK(transaction_fee_minor >= 0 AND transaction_fee_minor <= 10000 AND transaction_fee_minor = trunc(transaction_fee_minor))
);
ALTER TABLE "giving_checkouts" ADD COLUMN "transaction_fee_minor" numeric NOT NULL DEFAULT 0;
ALTER TABLE "giving_gifts" ADD COLUMN "transaction_fee_minor" numeric NOT NULL DEFAULT 0;
ALTER TABLE "giving_schedules" ADD COLUMN "transaction_fee_minor" numeric NOT NULL DEFAULT 0;
ALTER TABLE "giving_checkouts" ADD CONSTRAINT giving_checkouts_transaction_fee_minor_nonnegative_integer CHECK(transaction_fee_minor >= 0 AND transaction_fee_minor <= 10000 AND transaction_fee_minor = trunc(transaction_fee_minor));
ALTER TABLE "giving_gifts" ADD CONSTRAINT giving_gifts_transaction_fee_minor_nonnegative_integer CHECK(transaction_fee_minor >= 0 AND transaction_fee_minor <= 10000 AND transaction_fee_minor = trunc(transaction_fee_minor));
ALTER TABLE "giving_schedules" ADD CONSTRAINT giving_schedules_transaction_fee_minor_nonnegative_integer CHECK(transaction_fee_minor >= 0 AND transaction_fee_minor <= 10000 AND transaction_fee_minor = trunc(transaction_fee_minor));
`

export const GIVING_TRANSACTION_FEES_DOWN_SQL = String.raw`
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM giving_checkouts WHERE transaction_fee_minor <> 0)
    OR EXISTS(SELECT 1 FROM giving_gifts WHERE transaction_fee_minor <> 0)
    OR EXISTS(SELECT 1 FROM giving_schedules WHERE transaction_fee_minor <> 0)
  THEN RAISE EXCEPTION 'Cannot roll back giving transaction fees after fee-bearing activity'; END IF;
END $$;
ALTER TABLE "giving_schedules" DROP COLUMN "transaction_fee_minor";
ALTER TABLE "giving_gifts" DROP COLUMN "transaction_fee_minor";
ALTER TABLE "giving_checkouts" DROP COLUMN "transaction_fee_minor";
DROP TABLE "giving_settings";
`

export async function up({ db }: MigrateUpArgs) { await db.execute(sql.raw(GIVING_TRANSACTION_FEES_UP_SQL)) }
export async function down({ db }: MigrateDownArgs) { await db.execute(sql.raw(GIVING_TRANSACTION_FEES_DOWN_SQL)) }
