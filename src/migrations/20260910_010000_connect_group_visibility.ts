import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "connect_groups" ADD COLUMN "is_public" boolean DEFAULT false;
    CREATE INDEX "connect_groups_is_public_idx" ON "connect_groups" ("is_public");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX "connect_groups_is_public_idx";
    ALTER TABLE "connect_groups" DROP COLUMN "is_public";`)
}
