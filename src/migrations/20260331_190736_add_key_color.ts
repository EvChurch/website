import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_hero" ADD COLUMN "key_color" varchar;
  ALTER TABLE "pages_blocks_page_header" ADD COLUMN "key_color" varchar;
  ALTER TABLE "_pages_v_blocks_hero" ADD COLUMN "key_color" varchar;
  ALTER TABLE "_pages_v_blocks_page_header" ADD COLUMN "key_color" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_hero" DROP COLUMN "key_color";
  ALTER TABLE "pages_blocks_page_header" DROP COLUMN "key_color";
  ALTER TABLE "_pages_v_blocks_hero" DROP COLUMN "key_color";
  ALTER TABLE "_pages_v_blocks_page_header" DROP COLUMN "key_color";`)
}
