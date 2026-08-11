import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const DAILY_BIBLE_READINGS_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE "daily_bible_readings" (
  "id" serial PRIMARY KEY NOT NULL,
  "rock_id" numeric NOT NULL,
  "rock_guid" varchar NOT NULL,
  "source_name" varchar NOT NULL,
  "subject" varchar NOT NULL,
  "rock_sent_at" timestamp(3) with time zone NOT NULL,
  "source_date" timestamp(3) with time zone NOT NULL,
  "opening_scripture" varchar NOT NULL,
  "passage_reference" varchar NOT NULL,
  "passage_text" varchar NOT NULL,
  "is_published" boolean DEFAULT true NOT NULL,
  "imported_at" timestamp(3) with time zone NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "daily_bible_readings_questions" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "text" varchar NOT NULL
);

CREATE TABLE "daily_bible_readings_prayer_prompts" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "text" varchar NOT NULL
);

ALTER TABLE "daily_bible_readings_questions" ADD CONSTRAINT "daily_bible_readings_questions_parent_id_fk"
  FOREIGN KEY ("_parent_id") REFERENCES "public"."daily_bible_readings"("id") ON DELETE cascade;
ALTER TABLE "daily_bible_readings_prayer_prompts" ADD CONSTRAINT "daily_bible_readings_prayer_prompts_parent_id_fk"
  FOREIGN KEY ("_parent_id") REFERENCES "public"."daily_bible_readings"("id") ON DELETE cascade;

ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "daily_bible_readings_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_daily_bible_readings_fk"
  FOREIGN KEY ("daily_bible_readings_id") REFERENCES "public"."daily_bible_readings"("id") ON DELETE cascade;

CREATE UNIQUE INDEX "daily_bible_readings_rock_id_idx" ON "daily_bible_readings" ("rock_id");
CREATE UNIQUE INDEX "daily_bible_readings_rock_guid_idx" ON "daily_bible_readings" ("rock_guid");
CREATE INDEX "daily_bible_readings_rock_sent_at_idx" ON "daily_bible_readings" ("rock_sent_at");
CREATE INDEX "daily_bible_readings_source_date_idx" ON "daily_bible_readings" ("source_date");
CREATE INDEX "daily_bible_readings_is_published_idx" ON "daily_bible_readings" ("is_published");
CREATE INDEX "daily_bible_readings_published_order_idx" ON "daily_bible_readings"
  ("is_published", "source_date" DESC, "rock_sent_at" DESC, "rock_id" DESC);
CREATE INDEX "daily_bible_readings_updated_at_idx" ON "daily_bible_readings" ("updated_at");
CREATE INDEX "daily_bible_readings_created_at_idx" ON "daily_bible_readings" ("created_at");
CREATE INDEX "daily_bible_readings_questions_order_idx" ON "daily_bible_readings_questions" ("_order");
CREATE INDEX "daily_bible_readings_questions_parent_id_idx" ON "daily_bible_readings_questions" ("_parent_id");
CREATE INDEX "daily_bible_readings_prayer_prompts_order_idx" ON "daily_bible_readings_prayer_prompts" ("_order");
CREATE INDEX "daily_bible_readings_prayer_prompts_parent_id_idx" ON "daily_bible_readings_prayer_prompts" ("_parent_id");
CREATE INDEX "payload_locked_documents_rels_daily_bible_readings_id_idx"
  ON "payload_locked_documents_rels" ("daily_bible_readings_id");
`

export const DAILY_BIBLE_READINGS_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "payload_locked_documents_rels"
  DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_daily_bible_readings_fk";
DROP INDEX IF EXISTS "payload_locked_documents_rels_daily_bible_readings_id_idx";
ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "daily_bible_readings_id";
DROP TABLE IF EXISTS "daily_bible_readings_prayer_prompts" CASCADE;
DROP TABLE IF EXISTS "daily_bible_readings_questions" CASCADE;
DROP TABLE IF EXISTS "daily_bible_readings" CASCADE;
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(DAILY_BIBLE_READINGS_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(DAILY_BIBLE_READINGS_DOWN_SQL))
}
