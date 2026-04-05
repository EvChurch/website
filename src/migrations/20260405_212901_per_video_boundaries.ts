import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE 'transcriptSync';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE 'transcriptSync';
  ALTER TABLE "sermons_videos" ADD COLUMN "sermon_start_seconds" numeric;
  ALTER TABLE "sermons_videos" ADD COLUMN "sermon_end_seconds" numeric;
  ALTER TABLE "sermons_videos" ADD COLUMN "transcript" varchar;
  ALTER TABLE "sermons" DROP COLUMN "sermon_start_seconds";
  ALTER TABLE "sermons" DROP COLUMN "sermon_end_seconds";
  ALTER TABLE "sermons" DROP COLUMN "transcript";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'fullSermonSync', 'youtubeSync');
  ALTER TABLE "payload_jobs_log" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_log_task_slug" USING "task_slug"::"public"."enum_payload_jobs_log_task_slug";
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE text;
  DROP TYPE "public"."enum_payload_jobs_task_slug";
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'fullSermonSync', 'youtubeSync');
  ALTER TABLE "payload_jobs" ALTER COLUMN "task_slug" SET DATA TYPE "public"."enum_payload_jobs_task_slug" USING "task_slug"::"public"."enum_payload_jobs_task_slug";
  ALTER TABLE "sermons" ADD COLUMN "sermon_start_seconds" numeric;
  ALTER TABLE "sermons" ADD COLUMN "sermon_end_seconds" numeric;
  ALTER TABLE "sermons" ADD COLUMN "transcript" varchar;
  ALTER TABLE "sermons_videos" DROP COLUMN "sermon_start_seconds";
  ALTER TABLE "sermons_videos" DROP COLUMN "sermon_end_seconds";
  ALTER TABLE "sermons_videos" DROP COLUMN "transcript";`)
}
