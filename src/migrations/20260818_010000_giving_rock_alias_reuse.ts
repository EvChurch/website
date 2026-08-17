import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const GIVING_ROCK_ALIAS_REUSE_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '60s';
DROP INDEX IF EXISTS giving_provider_operations_provider_id_unique;
CREATE UNIQUE INDEX giving_provider_operations_provider_id_unique
  ON giving_provider_operations(environment,provider,provider_id)
  WHERE provider_id IS NOT NULL AND provider='blinkpay';
`

export const GIVING_ROCK_ALIAS_REUSE_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '60s';
DO $$ BEGIN
  IF EXISTS(
    SELECT 1 FROM giving_provider_operations
    WHERE provider_id IS NOT NULL
    GROUP BY environment,provider,provider_id
    HAVING count(*) > 1
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot restore global provider ID uniqueness after a Rock alias has been reused';
  END IF;
END $$;
DROP INDEX IF EXISTS giving_provider_operations_provider_id_unique;
CREATE UNIQUE INDEX giving_provider_operations_provider_id_unique
  ON giving_provider_operations(environment,provider,provider_id)
  WHERE provider_id IS NOT NULL;
`

export async function up({ db }: MigrateUpArgs) { await db.execute(sql.raw(GIVING_ROCK_ALIAS_REUSE_UP_SQL)) }
export async function down({ db }: MigrateDownArgs) { await db.execute(sql.raw(GIVING_ROCK_ALIAS_REUSE_DOWN_SQL)) }
