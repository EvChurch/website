import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

const pageBlocks = [
  'hero', 'daily_reading', 'service_times', 'content', 'cta', 'card_grid',
  'accordion', 'image_gallery', 'video', 'feature_grid', 'timeline', 'stats_grid',
  'blockquote', 'form_embed', 'manual_card_grid', 'photo_strip', 'page_header',
  'gospel_stepper', 'latest_sermon', 'upcoming_events', 'connect_groups',
]
const existingTables = [
  ...pageBlocks.flatMap((block) => [`pages_blocks_${block}`, `_pages_v_blocks_${block}`]),
  'campuses_blocks_upcoming_events',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    SET LOCAL lock_timeout = '5s';
    DO $$ BEGIN
      CREATE TYPE "block_visibility_timezone" AS ENUM ('Pacific/Auckland');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  for (const table of existingTables) {
    await db.execute(sql.raw(`ALTER TABLE "${table}"
      ADD COLUMN IF NOT EXISTS "visibility_from" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "visibility_until" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "visibility_from_tz" "block_visibility_timezone" DEFAULT 'Pacific/Auckland',
      ADD COLUMN IF NOT EXISTS "visibility_until_tz" "block_visibility_timezone" DEFAULT 'Pacific/Auckland';`))
  }
  for (const version of [false, true]) {
    const table = version ? '_pages_v_blocks_christmas_banner' : 'pages_blocks_christmas_banner'
    const parent = version ? '_pages_v' : 'pages'
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS "${table}" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL REFERENCES "${parent}"("id") ON DELETE CASCADE,
        "_path" text NOT NULL,
        "id" ${version ? 'serial' : 'varchar'} PRIMARY KEY NOT NULL,
        ${version ? '"_uuid" varchar,' : ''}
        "visibility_from" timestamp(3) with time zone,
        "visibility_until" timestamp(3) with time zone,
        "visibility_from_tz" "block_visibility_timezone" DEFAULT 'Pacific/Auckland',
        "visibility_until_tz" "block_visibility_timezone" DEFAULT 'Pacific/Auckland',
        "block_name" varchar
      );
      CREATE INDEX IF NOT EXISTS "${table}_order_idx" ON "${table}" ("_order");
      CREATE INDEX IF NOT EXISTS "${table}_parent_id_idx" ON "${table}" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "${table}_path_idx" ON "${table}" ("_path");
    `))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`SET LOCAL lock_timeout = '5s';`)
  await db.execute(sql`DROP TABLE IF EXISTS "pages_blocks_christmas_banner", "_pages_v_blocks_christmas_banner";`)
  for (const table of existingTables) {
    await db.execute(sql.raw(`ALTER TABLE "${table}"
      DROP COLUMN IF EXISTS "visibility_from", DROP COLUMN IF EXISTS "visibility_until",
      DROP COLUMN IF EXISTS "visibility_from_tz", DROP COLUMN IF EXISTS "visibility_until_tz";`))
  }
  await db.execute(sql`DROP TYPE IF EXISTS "block_visibility_timezone";`)
}
