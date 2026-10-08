import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const CONNECT_GROUP_MEMBER_COUNT_UP_SQL = String.raw`
  SET LOCAL lock_timeout = '5s';
  SET LOCAL statement_timeout = '30s';

  ALTER TABLE "connect_groups"
    ADD COLUMN "member_count" numeric;
`

export const CONNECT_GROUP_MEMBER_COUNT_DOWN_SQL = String.raw`
  SET LOCAL lock_timeout = '5s';
  SET LOCAL statement_timeout = '30s';

  ALTER TABLE "connect_groups"
    DROP COLUMN "member_count";
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(CONNECT_GROUP_MEMBER_COUNT_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(CONNECT_GROUP_MEMBER_COUNT_DOWN_SQL))
}
