import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const GIVING_APPRENTICE_FUNDS_UP_SQL = String.raw`
ALTER TABLE "giving_funds" ADD COLUMN IF NOT EXISTS "apprentice_related" boolean DEFAULT false NOT NULL;
CREATE INDEX IF NOT EXISTS "giving_funds_apprentice_related_idx" ON "giving_funds" USING btree ("apprentice_related");
`

export const GIVING_APPRENTICE_FUNDS_DOWN_SQL = String.raw`
DROP INDEX IF EXISTS "giving_funds_apprentice_related_idx";
ALTER TABLE "giving_funds" DROP COLUMN IF EXISTS "apprentice_related";
`

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql.raw(GIVING_APPRENTICE_FUNDS_UP_SQL))
}

export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql.raw(GIVING_APPRENTICE_FUNDS_DOWN_SQL))
}
