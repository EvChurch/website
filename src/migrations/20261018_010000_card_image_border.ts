import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "pages_blocks_manual_card_grid_cards"
      ADD COLUMN IF NOT EXISTS "image_border" boolean DEFAULT false;
    ALTER TABLE "_pages_v_blocks_manual_card_grid_cards"
      ADD COLUMN IF NOT EXISTS "image_border" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "_pages_v_blocks_manual_card_grid_cards"
      DROP COLUMN IF EXISTS "image_border";
    ALTER TABLE "pages_blocks_manual_card_grid_cards"
      DROP COLUMN IF EXISTS "image_border";
  `)
}
