import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_pages_blocks_hero_overlay_style" ADD VALUE IF NOT EXISTS 'banner';
    ALTER TYPE "enum__pages_v_blocks_hero_overlay_style" ADD VALUE IF NOT EXISTS 'banner';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Postgres does not support removing values from enums without recreating them.
  // The 'banner' value will remain but is harmless if unused.
}
