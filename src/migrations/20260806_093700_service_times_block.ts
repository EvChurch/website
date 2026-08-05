import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export const SERVICE_TIMES_BLOCK_UP_SQL = String.raw`
  CREATE TABLE "pages_blocks_service_times" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "heading" varchar DEFAULT 'Join us this Sunday' NOT NULL,
    "block_name" varchar
  );

  CREATE TABLE "pages_blocks_service_times_services" (
    "_order" integer NOT NULL,
    "_parent_id" varchar NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "campus" varchar NOT NULL,
    "time" varchar NOT NULL,
    "href" varchar NOT NULL
  );

  CREATE TABLE "_pages_v_blocks_service_times" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "heading" varchar DEFAULT 'Join us this Sunday' NOT NULL,
    "_uuid" varchar,
    "block_name" varchar
  );

  CREATE TABLE "_pages_v_blocks_service_times_services" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "campus" varchar NOT NULL,
    "time" varchar NOT NULL,
    "href" varchar NOT NULL,
    "_uuid" varchar
  );

  ALTER TABLE "pages_blocks_service_times"
    ADD CONSTRAINT "pages_blocks_service_times_parent_id_fk"
    FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id")
    ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_service_times_services"
    ADD CONSTRAINT "pages_blocks_service_times_services_parent_id_fk"
    FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_service_times"("id")
    ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_service_times"
    ADD CONSTRAINT "_pages_v_blocks_service_times_parent_id_fk"
    FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id")
    ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_service_times_services"
    ADD CONSTRAINT "_pages_v_blocks_service_times_services_parent_id_fk"
    FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_service_times"("id")
    ON DELETE cascade ON UPDATE no action;

  CREATE INDEX "pages_blocks_service_times_order_idx" ON "pages_blocks_service_times" ("_order");
  CREATE INDEX "pages_blocks_service_times_parent_id_idx" ON "pages_blocks_service_times" ("_parent_id");
  CREATE INDEX "pages_blocks_service_times_path_idx" ON "pages_blocks_service_times" ("_path");
  CREATE INDEX "pages_blocks_service_times_services_order_idx" ON "pages_blocks_service_times_services" ("_order");
  CREATE INDEX "pages_blocks_service_times_services_parent_id_idx" ON "pages_blocks_service_times_services" ("_parent_id");
  CREATE INDEX "_pages_v_blocks_service_times_order_idx" ON "_pages_v_blocks_service_times" ("_order");
  CREATE INDEX "_pages_v_blocks_service_times_parent_id_idx" ON "_pages_v_blocks_service_times" ("_parent_id");
  CREATE INDEX "_pages_v_blocks_service_times_path_idx" ON "_pages_v_blocks_service_times" ("_path");
  CREATE INDEX "_pages_v_blocks_service_times_services_order_idx" ON "_pages_v_blocks_service_times_services" ("_order");
  CREATE INDEX "_pages_v_blocks_service_times_services_parent_id_idx" ON "_pages_v_blocks_service_times_services" ("_parent_id");

  DO $$
  DECLARE
    home_page_id integer;
    home_version_id integer;
    insertion_order integer;
    version_service_times_id integer;
    block_table text;
  BEGIN
    SELECT "id" INTO home_page_id FROM "pages" WHERE "slug" = 'home' LIMIT 1;

    IF home_page_id IS NOT NULL THEN
      SELECT COALESCE(MIN("_order") + 1, 1)
        INTO insertion_order
        FROM "pages_blocks_hero"
        WHERE "_parent_id" = home_page_id;

      FOR block_table IN
        SELECT DISTINCT tc.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.constraint_schema = kcu.constraint_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
          AND tc.constraint_schema = ccu.constraint_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name LIKE 'pages_blocks_%'
          AND kcu.column_name = '_parent_id'
          AND ccu.table_name = 'pages'
      LOOP
        EXECUTE format(
          'UPDATE %I SET _order = _order + 1 WHERE _parent_id = $1 AND _order >= $2',
          block_table
        ) USING home_page_id, insertion_order;
      END LOOP;

      INSERT INTO "pages_blocks_service_times" (
        "_order", "_parent_id", "_path", "id", "heading"
      ) VALUES (
        insertion_order, home_page_id, 'layout', 'service-times-home', 'Join us this Sunday'
      );

      INSERT INTO "pages_blocks_service_times_services" (
        "_order", "_parent_id", "id", "campus", "time", "href"
      ) VALUES
        (1, 'service-times-home', 'service-times-north', 'North', '10:15 am', '/campus/north'),
        (2, 'service-times-home', 'service-times-central', 'Central', '10:15 am', '/campus/central'),
        (3, 'service-times-home', 'service-times-unichurch', 'Unichurch', '5:15 pm', '/campus/unichurch');

      SELECT "id" INTO home_version_id
        FROM "_pages_v"
        WHERE "parent_id" = home_page_id
        ORDER BY "created_at" DESC
        LIMIT 1;

      IF home_version_id IS NOT NULL THEN
        SELECT COALESCE(MIN("_order") + 1, 1)
          INTO insertion_order
          FROM "_pages_v_blocks_hero"
          WHERE "_parent_id" = home_version_id;

        FOR block_table IN
          SELECT DISTINCT tc.table_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.constraint_schema = kcu.constraint_schema
          JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
            AND tc.constraint_schema = ccu.constraint_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
            AND tc.table_name LIKE '\_pages\_v\_blocks\_%' ESCAPE '\'
            AND kcu.column_name = '_parent_id'
            AND ccu.table_name = '_pages_v'
        LOOP
          EXECUTE format(
            'UPDATE %I SET _order = _order + 1 WHERE _parent_id = $1 AND _order >= $2',
            block_table
          ) USING home_version_id, insertion_order;
        END LOOP;

        INSERT INTO "_pages_v_blocks_service_times" (
          "_order", "_parent_id", "_path", "heading", "_uuid"
        ) VALUES (
          insertion_order, home_version_id, 'version.layout', 'Join us this Sunday', 'service-times-home'
        ) RETURNING "id" INTO version_service_times_id;

        INSERT INTO "_pages_v_blocks_service_times_services" (
          "_order", "_parent_id", "campus", "time", "href", "_uuid"
        ) VALUES
          (1, version_service_times_id, 'North', '10:15 am', '/campus/north', 'service-times-north'),
          (2, version_service_times_id, 'Central', '10:15 am', '/campus/central', 'service-times-central'),
          (3, version_service_times_id, 'Unichurch', '5:15 pm', '/campus/unichurch', 'service-times-unichurch');
      END IF;
    END IF;
  END $$;
`

export const SERVICE_TIMES_BLOCK_DOWN_SQL = String.raw`
  DROP TABLE "_pages_v_blocks_service_times_services" CASCADE;
  DROP TABLE "_pages_v_blocks_service_times" CASCADE;
  DROP TABLE "pages_blocks_service_times_services" CASCADE;
  DROP TABLE "pages_blocks_service_times" CASCADE;
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(SERVICE_TIMES_BLOCK_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(SERVICE_TIMES_BLOCK_DOWN_SQL))
}
