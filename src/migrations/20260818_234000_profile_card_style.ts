import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const PROFILE_CARD_STYLE_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TYPE "public"."enum_pages_blocks_manual_card_grid_card_style"
  ADD VALUE IF NOT EXISTS 'profile' BEFORE 'alternatingRows';
ALTER TYPE "public"."enum__pages_v_blocks_manual_card_grid_card_style"
  ADD VALUE IF NOT EXISTS 'profile' BEFORE 'alternatingRows';
`

export const PROFILE_CARD_STYLE_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "pages_blocks_manual_card_grid" WHERE "card_style" = 'profile' LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM "_pages_v_blocks_manual_card_grid" WHERE "card_style" = 'profile' LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot remove the profile card style while page content uses it';
  END IF;
END $$;

ALTER TABLE "pages_blocks_manual_card_grid" ALTER COLUMN "card_style" DROP DEFAULT;
ALTER TYPE "public"."enum_pages_blocks_manual_card_grid_card_style"
  RENAME TO "enum_pages_blocks_manual_card_grid_card_style_old";
CREATE TYPE "public"."enum_pages_blocks_manual_card_grid_card_style"
  AS ENUM ('info', 'imageOverlay', 'imageTop', 'alternatingRows');
ALTER TABLE "pages_blocks_manual_card_grid" ALTER COLUMN "card_style"
  TYPE "public"."enum_pages_blocks_manual_card_grid_card_style"
  USING "card_style"::text::"public"."enum_pages_blocks_manual_card_grid_card_style";
DROP TYPE "public"."enum_pages_blocks_manual_card_grid_card_style_old";
ALTER TABLE "pages_blocks_manual_card_grid" ALTER COLUMN "card_style" SET DEFAULT 'info';

ALTER TABLE "_pages_v_blocks_manual_card_grid" ALTER COLUMN "card_style" DROP DEFAULT;
ALTER TYPE "public"."enum__pages_v_blocks_manual_card_grid_card_style"
  RENAME TO "enum__pages_v_blocks_manual_card_grid_card_style_old";
CREATE TYPE "public"."enum__pages_v_blocks_manual_card_grid_card_style"
  AS ENUM ('info', 'imageOverlay', 'imageTop', 'alternatingRows');
ALTER TABLE "_pages_v_blocks_manual_card_grid" ALTER COLUMN "card_style"
  TYPE "public"."enum__pages_v_blocks_manual_card_grid_card_style"
  USING "card_style"::text::"public"."enum__pages_v_blocks_manual_card_grid_card_style";
DROP TYPE "public"."enum__pages_v_blocks_manual_card_grid_card_style_old";
ALTER TABLE "_pages_v_blocks_manual_card_grid" ALTER COLUMN "card_style" SET DEFAULT 'info';
`

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql.raw(PROFILE_CARD_STYLE_UP_SQL))
}

export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql.raw(PROFILE_CARD_STYLE_DOWN_SQL))
}
