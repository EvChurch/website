import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql.raw(`
    SET LOCAL lock_timeout = '5s';
    SET LOCAL statement_timeout = '30s';
    CREATE TABLE "connect_group_comments" (
      "id" serial PRIMARY KEY,
      "rock_group_id" numeric NOT NULL,
      "author_rock_person_id" numeric NOT NULL,
      "author_name" varchar NOT NULL,
      "body" varchar NOT NULL,
      "deleted_at" timestamp(3) with time zone,
      "deleted_by_rock_person_id" numeric,
      "deleted_by_name" varchar,
      "visibility" varchar NOT NULL DEFAULT 'leaders-and-coaches',
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );
    CREATE INDEX "connect_group_comments_rock_group_id_idx" ON "connect_group_comments" ("rock_group_id");
    CREATE INDEX "connect_group_comments_author_rock_person_id_idx" ON "connect_group_comments" ("author_rock_person_id");
    CREATE INDEX "connect_group_comments_deleted_at_idx" ON "connect_group_comments" ("deleted_at");
    CREATE INDEX "connect_group_comments_deleted_by_rock_person_id_idx" ON "connect_group_comments" ("deleted_by_rock_person_id");
    CREATE INDEX "connect_group_comments_created_at_idx" ON "connect_group_comments" ("created_at");
    CREATE INDEX "connect_group_comments_updated_at_idx" ON "connect_group_comments" ("updated_at");
  `))
}

export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql.raw(`
    SET LOCAL lock_timeout = '5s';
    SET LOCAL statement_timeout = '30s';
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM "connect_group_comments") THEN
        RAISE EXCEPTION 'Cannot roll back while Connect Group comments exist';
      END IF;
    END $$;
    DROP TABLE IF EXISTS "connect_group_comments";
  `))
}
