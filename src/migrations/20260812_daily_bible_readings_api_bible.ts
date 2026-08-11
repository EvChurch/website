import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

export const DAILY_BIBLE_READINGS_API_BIBLE_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE "daily_bible_readings" ADD COLUMN "passage_provider" varchar;
CREATE TYPE "public"."enum_daily_bible_readings_passage_provider" AS ENUM('api-bible');
ALTER TABLE "daily_bible_readings" ALTER COLUMN "passage_provider" TYPE "public"."enum_daily_bible_readings_passage_provider" USING "passage_provider"::"public"."enum_daily_bible_readings_passage_provider";
ALTER TABLE "daily_bible_readings" ADD COLUMN "bible_version_id" varchar;
ALTER TABLE "daily_bible_readings" ADD COLUMN "bible_version_abbreviation" varchar;
ALTER TABLE "daily_bible_readings" ADD COLUMN "bible_version_title" varchar;
ALTER TABLE "daily_bible_readings" ADD COLUMN "api_bible_passage_id" varchar;
ALTER TABLE "daily_bible_readings" ADD COLUMN "api_bible_fums_token" varchar;
ALTER TABLE "daily_bible_readings" ADD COLUMN "bible_copyright" varchar;
ALTER TABLE "daily_bible_readings" ADD COLUMN "scripture_fetched_at" timestamp(3) with time zone;
`

export const DAILY_BIBLE_READINGS_API_BIBLE_DOWN_SQL = String.raw`
ALTER TABLE "daily_bible_readings" DROP COLUMN IF EXISTS "scripture_fetched_at";
ALTER TABLE "daily_bible_readings" DROP COLUMN IF EXISTS "bible_copyright";
ALTER TABLE "daily_bible_readings" DROP COLUMN IF EXISTS "api_bible_fums_token";
ALTER TABLE "daily_bible_readings" DROP COLUMN IF EXISTS "api_bible_passage_id";
ALTER TABLE "daily_bible_readings" DROP COLUMN IF EXISTS "bible_version_title";
ALTER TABLE "daily_bible_readings" DROP COLUMN IF EXISTS "bible_version_abbreviation";
ALTER TABLE "daily_bible_readings" DROP COLUMN IF EXISTS "bible_version_id";
ALTER TABLE "daily_bible_readings" DROP COLUMN IF EXISTS "passage_provider";
DROP TYPE IF EXISTS "public"."enum_daily_bible_readings_passage_provider";
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(DAILY_BIBLE_READINGS_API_BIBLE_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(DAILY_BIBLE_READINGS_API_BIBLE_DOWN_SQL))
}
