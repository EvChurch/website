import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export const HOME_DAILY_READING_BLOCK_UP_SQL = String.raw`
CREATE TABLE "pages_blocks_daily_reading" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "_path" text NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "eyebrow" varchar DEFAULT 'A word from God for you today',
  "heading" varchar DEFAULT 'Make room for the word.',
  "block_name" varchar
);

CREATE TABLE "_pages_v_blocks_daily_reading" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "_path" text NOT NULL,
  "id" serial PRIMARY KEY NOT NULL,
  "eyebrow" varchar DEFAULT 'A word from God for you today',
  "heading" varchar DEFAULT 'Make room for the word.',
  "_uuid" varchar,
  "block_name" varchar
);

ALTER TABLE "pages_blocks_daily_reading" ADD CONSTRAINT "pages_blocks_daily_reading_parent_id_fk"
  FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade;
ALTER TABLE "_pages_v_blocks_daily_reading" ADD CONSTRAINT "_pages_v_blocks_daily_reading_parent_id_fk"
  FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade;
CREATE INDEX "pages_blocks_daily_reading_order_idx" ON "pages_blocks_daily_reading" ("_order");
CREATE INDEX "pages_blocks_daily_reading_parent_id_idx" ON "pages_blocks_daily_reading" ("_parent_id");
CREATE INDEX "pages_blocks_daily_reading_path_idx" ON "pages_blocks_daily_reading" ("_path");
CREATE INDEX "_pages_v_blocks_daily_reading_order_idx" ON "_pages_v_blocks_daily_reading" ("_order");
CREATE INDEX "_pages_v_blocks_daily_reading_parent_id_idx" ON "_pages_v_blocks_daily_reading" ("_parent_id");
CREATE INDEX "_pages_v_blocks_daily_reading_path_idx" ON "_pages_v_blocks_daily_reading" ("_path");

DO $$
DECLARE
  home_page_id integer;
  home_version_id integer;
  insertion_order integer;
  block_table text;
BEGIN
  SELECT "id" INTO home_page_id FROM "pages" WHERE "slug" = 'home' LIMIT 1;
  IF home_page_id IS NOT NULL THEN
    SELECT "_order" + 1 INTO insertion_order
      FROM "pages_blocks_manual_card_grid"
      WHERE "_parent_id" = home_page_id
        AND lower(trim("heading")) = 'your next step'
      ORDER BY "_order" DESC
      LIMIT 1;
    IF insertion_order IS NULL THEN
      SELECT COALESCE(MIN("_order") + 1, 0) INTO insertion_order
        FROM "pages_blocks_hero" WHERE "_parent_id" = home_page_id;
    END IF;
    FOR block_table IN
      SELECT DISTINCT tc.table_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.constraint_schema = kcu.constraint_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.constraint_schema = ccu.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
        AND tc.table_name LIKE 'pages_blocks_%' AND kcu.column_name = '_parent_id'
        AND ccu.table_name = 'pages' AND tc.table_name <> 'pages_blocks_daily_reading'
    LOOP
      EXECUTE format('UPDATE %I SET _order = _order + 1 WHERE _parent_id = $1 AND _order >= $2', block_table)
        USING home_page_id, insertion_order;
    END LOOP;
    INSERT INTO "pages_blocks_daily_reading" ("_order", "_parent_id", "_path", "id", "eyebrow", "heading")
      VALUES (insertion_order, home_page_id, 'layout', 'daily-reading-home', 'A word from God for you today', 'Make room for the word.');

    SELECT "id" INTO home_version_id FROM "_pages_v"
      WHERE "parent_id" = home_page_id ORDER BY "created_at" DESC LIMIT 1;
    IF home_version_id IS NOT NULL THEN
      SELECT "_order" + 1 INTO insertion_order
        FROM "_pages_v_blocks_manual_card_grid"
        WHERE "_parent_id" = home_version_id
          AND lower(trim("heading")) = 'your next step'
        ORDER BY "_order" DESC
        LIMIT 1;
      IF insertion_order IS NULL THEN
        SELECT COALESCE(MIN("_order") + 1, 0) INTO insertion_order
          FROM "_pages_v_blocks_hero" WHERE "_parent_id" = home_version_id;
      END IF;
      FOR block_table IN
        SELECT DISTINCT tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.constraint_schema = kcu.constraint_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name AND tc.constraint_schema = ccu.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
          AND tc.table_name LIKE '\_pages\_v\_blocks\_%' ESCAPE '\'
          AND kcu.column_name = '_parent_id' AND ccu.table_name = '_pages_v'
          AND tc.table_name <> '_pages_v_blocks_daily_reading'
      LOOP
        EXECUTE format('UPDATE %I SET _order = _order + 1 WHERE _parent_id = $1 AND _order >= $2', block_table)
          USING home_version_id, insertion_order;
      END LOOP;
      INSERT INTO "_pages_v_blocks_daily_reading" ("_order", "_parent_id", "_path", "eyebrow", "heading", "_uuid")
        VALUES (insertion_order, home_version_id, 'version.layout', 'A word from God for you today', 'Make room for the word.', 'daily-reading-home');
    END IF;
  END IF;
END $$;
`

export const HOME_DAILY_READING_BLOCK_DOWN_SQL = String.raw`
DROP TABLE IF EXISTS "_pages_v_blocks_daily_reading" CASCADE;
DROP TABLE IF EXISTS "pages_blocks_daily_reading" CASCADE;
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(HOME_DAILY_READING_BLOCK_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(HOME_DAILY_READING_BLOCK_DOWN_SQL))
}
