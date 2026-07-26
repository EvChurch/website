import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // 1. Add new columns and constraints
  await db.execute(sql`
  ALTER TABLE "sermons_videos" ADD COLUMN "speaker_id" integer;
  ALTER TABLE "sermons" ADD COLUMN "audio_speaker_id" integer;
  ALTER TABLE "sermons_videos" ADD CONSTRAINT "sermons_videos_speaker_id_speakers_id_fk" FOREIGN KEY ("speaker_id") REFERENCES "public"."speakers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sermons" ADD CONSTRAINT "sermons_audio_speaker_id_speakers_id_fk" FOREIGN KEY ("audio_speaker_id") REFERENCES "public"."speakers"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "sermons_videos_speaker_idx" ON "sermons_videos" USING btree ("speaker_id");
  CREATE INDEX "sermons_audio_speaker_idx" ON "sermons" USING btree ("audio_speaker_id");`)

  // 2. Migrate existing speaker data: copy the first speaker from the rels table
  //    into the new audio_speaker_id column on each sermon
  await db.execute(sql`
  UPDATE "sermons" s
  SET "audio_speaker_id" = sub."speakers_id"
  FROM (
    SELECT DISTINCT ON (parent_id) parent_id, speakers_id
    FROM "sermons_rels"
    WHERE path = 'speakers' AND speakers_id IS NOT NULL
    ORDER BY parent_id, "order" ASC
  ) sub
  WHERE s.id = sub.parent_id;`)

  // 3. Now safe to remove the old speakers column from the rels table
  await db.execute(sql`
  ALTER TABLE "sermons_rels" DROP CONSTRAINT "sermons_rels_speakers_fk";
  DROP INDEX "sermons_rels_speakers_id_idx";
  ALTER TABLE "sermons_rels" DROP COLUMN "speakers_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sermons_videos" DROP CONSTRAINT "sermons_videos_speaker_id_speakers_id_fk";
  
  ALTER TABLE "sermons" DROP CONSTRAINT "sermons_audio_speaker_id_speakers_id_fk";
  
  DROP INDEX "sermons_videos_speaker_idx";
  DROP INDEX "sermons_audio_speaker_idx";
  ALTER TABLE "sermons_rels" ADD COLUMN "speakers_id" integer;
  ALTER TABLE "sermons_rels" ADD CONSTRAINT "sermons_rels_speakers_fk" FOREIGN KEY ("speakers_id") REFERENCES "public"."speakers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "sermons_rels_speakers_id_idx" ON "sermons_rels" USING btree ("speakers_id");

  INSERT INTO "sermons_rels" ("order", "parent_id", "path", "speakers_id")
  SELECT 1, "id", 'speakers', "audio_speaker_id"
  FROM "sermons"
  WHERE "audio_speaker_id" IS NOT NULL;

  ALTER TABLE "sermons_videos" DROP COLUMN "speaker_id";
  ALTER TABLE "sermons" DROP COLUMN "audio_speaker_id";`)
}
