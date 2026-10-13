import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const CONNECT_GROUPS_FINDER_UP_SQL = String.raw`
  SET LOCAL lock_timeout = '5s';
  SET LOCAL statement_timeout = '30s';

  ALTER TABLE "connect_groups"
    ADD COLUMN "rock_group_guid" varchar,
    ADD COLUMN "public_name" varchar,
    ADD COLUMN "meeting_day" numeric,
    ADD COLUMN "meeting_time" varchar,
    ADD COLUMN "schedule_text" varchar;

  ALTER TABLE "connect_groups_leaders"
    ADD COLUMN "photo_id" numeric;

  CREATE UNIQUE INDEX "connect_groups_rock_group_guid_idx"
    ON "connect_groups" USING btree ("rock_group_guid");

  CREATE TABLE "pages_blocks_connect_groups" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "eyebrow" varchar DEFAULT 'Find your people',
    "heading" varchar DEFAULT 'Find a Connect Group',
    "description" varchar DEFAULT 'Explore Connect Groups across Auckland and choose one that works for you.',
    "block_name" varchar
  );

  CREATE TABLE "_pages_v_blocks_connect_groups" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "eyebrow" varchar DEFAULT 'Find your people',
    "heading" varchar DEFAULT 'Find a Connect Group',
    "description" varchar DEFAULT 'Explore Connect Groups across Auckland and choose one that works for you.',
    "_uuid" varchar,
    "block_name" varchar
  );

  ALTER TABLE "pages_blocks_connect_groups"
    ADD CONSTRAINT "pages_blocks_connect_groups_parent_id_fk"
    FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id")
    ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_connect_groups"
    ADD CONSTRAINT "_pages_v_blocks_connect_groups_parent_id_fk"
    FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id")
    ON DELETE cascade ON UPDATE no action;

  CREATE INDEX "pages_blocks_connect_groups_order_idx"
    ON "pages_blocks_connect_groups" USING btree ("_order");
  CREATE INDEX "pages_blocks_connect_groups_parent_id_idx"
    ON "pages_blocks_connect_groups" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_connect_groups_path_idx"
    ON "pages_blocks_connect_groups" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_connect_groups_order_idx"
    ON "_pages_v_blocks_connect_groups" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_connect_groups_parent_id_idx"
    ON "_pages_v_blocks_connect_groups" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_connect_groups_path_idx"
    ON "_pages_v_blocks_connect_groups" USING btree ("_path");

`

export const CONNECT_GROUPS_FINDER_DOWN_SQL = String.raw`
  SET LOCAL lock_timeout = '5s';
  SET LOCAL statement_timeout = '30s';

  DROP TABLE "_pages_v_blocks_connect_groups" CASCADE;
  DROP TABLE "pages_blocks_connect_groups" CASCADE;
  DROP INDEX IF EXISTS "connect_groups_rock_group_guid_idx";
  ALTER TABLE "connect_groups"
    DROP COLUMN "schedule_text",
    DROP COLUMN "meeting_time",
    DROP COLUMN "meeting_day",
    DROP COLUMN "public_name",
    DROP COLUMN "rock_group_guid";
  ALTER TABLE "connect_groups_leaders"
    DROP COLUMN "photo_id";
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(CONNECT_GROUPS_FINDER_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(CONNECT_GROUPS_FINDER_DOWN_SQL))
}
