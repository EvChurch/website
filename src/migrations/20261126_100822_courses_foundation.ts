import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
CREATE TYPE "public"."enum_courses_status" AS ENUM('draft', 'published');
CREATE TYPE "public"."enum__courses_v_version_status" AS ENUM('draft', 'published');
CREATE TYPE "public"."enum_course_attempts_mode" AS ENUM('solo', 'group');
CREATE TABLE "courses_blocks_course_teaching" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "body" jsonb,
    "block_name" varchar
  );
CREATE TABLE "courses_blocks_course_image" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "image_id" integer,
    "caption" varchar,
    "block_name" varchar
  );
CREATE TABLE "courses_blocks_course_video" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "url" varchar,
    "title" varchar,
    "block_name" varchar
  );
CREATE TABLE "courses_lessons" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "lesson_id" varchar,
    "title" varchar,
    "required" boolean DEFAULT true
  );
CREATE TABLE "courses" (
    "id" serial PRIMARY KEY NOT NULL,
    "title" varchar,
    "slug" varchar,
    "summary" varchar,
    "enrolment_open" boolean DEFAULT true,
    "allow_solo" boolean DEFAULT true,
    "allow_group" boolean DEFAULT true,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "_status" "enum_courses_status" DEFAULT 'draft'
  );
CREATE TABLE "_courses_v_blocks_course_teaching" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "body" jsonb,
    "_uuid" varchar,
    "block_name" varchar
  );
CREATE TABLE "_courses_v_blocks_course_image" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "image_id" integer,
    "caption" varchar,
    "_uuid" varchar,
    "block_name" varchar
  );
CREATE TABLE "_courses_v_blocks_course_video" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "url" varchar,
    "title" varchar,
    "_uuid" varchar,
    "block_name" varchar
  );
CREATE TABLE "_courses_v_version_lessons" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "lesson_id" varchar,
    "title" varchar,
    "required" boolean DEFAULT true,
    "_uuid" varchar
  );
CREATE TABLE "_courses_v" (
    "id" serial PRIMARY KEY NOT NULL,
    "parent_id" integer,
    "version_title" varchar,
    "version_slug" varchar,
    "version_summary" varchar,
    "version_enrolment_open" boolean DEFAULT true,
    "version_allow_solo" boolean DEFAULT true,
    "version_allow_group" boolean DEFAULT true,
    "version_updated_at" timestamp(3) with time zone,
    "version_created_at" timestamp(3) with time zone,
    "version__status" "enum__courses_v_version_status" DEFAULT 'draft',
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "latest" boolean
  );
CREATE TABLE "course_editions" (
    "id" serial PRIMARY KEY NOT NULL,
    "course_id" integer NOT NULL,
    "structure_key" varchar NOT NULL,
    "snapshot" jsonb NOT NULL,
    "published_at" timestamp(3) with time zone NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
CREATE TABLE "course_attempts" (
    "id" serial PRIMARY KEY NOT NULL,
    "account_key" varchar NOT NULL,
    "edition_id" integer NOT NULL,
    "mode" "enum_course_attempts_mode" DEFAULT 'solo' NOT NULL,
    "completed_lesson_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "completed_at" timestamp(3) with time zone,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "courses_find" boolean DEFAULT false;
ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "courses_create" boolean DEFAULT false;
ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "courses_update" boolean DEFAULT false;
ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "courses_delete" boolean DEFAULT false;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "courses_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "course_editions_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "course_attempts_id" integer;
ALTER TABLE "courses_blocks_course_teaching" ADD CONSTRAINT "courses_blocks_course_teaching_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "courses_blocks_course_image" ADD CONSTRAINT "courses_blocks_course_image_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "courses_blocks_course_image" ADD CONSTRAINT "courses_blocks_course_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "courses_blocks_course_video" ADD CONSTRAINT "courses_blocks_course_video_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "courses_lessons" ADD CONSTRAINT "courses_lessons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "_courses_v_blocks_course_teaching" ADD CONSTRAINT "_courses_v_blocks_course_teaching_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "_courses_v_blocks_course_image" ADD CONSTRAINT "_courses_v_blocks_course_image_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "_courses_v_blocks_course_image" ADD CONSTRAINT "_courses_v_blocks_course_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "_courses_v_blocks_course_video" ADD CONSTRAINT "_courses_v_blocks_course_video_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "_courses_v_version_lessons" ADD CONSTRAINT "_courses_v_version_lessons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "_courses_v" ADD CONSTRAINT "_courses_v_parent_id_courses_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "course_editions" ADD CONSTRAINT "course_editions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "course_attempts" ADD CONSTRAINT "course_attempts_edition_id_course_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."course_editions"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "courses_blocks_course_teaching_order_idx" ON "courses_blocks_course_teaching" USING btree ("_order");
CREATE INDEX "courses_blocks_course_teaching_parent_id_idx" ON "courses_blocks_course_teaching" USING btree ("_parent_id");
CREATE INDEX "courses_blocks_course_teaching_path_idx" ON "courses_blocks_course_teaching" USING btree ("_path");
CREATE INDEX "courses_blocks_course_image_order_idx" ON "courses_blocks_course_image" USING btree ("_order");
CREATE INDEX "courses_blocks_course_image_parent_id_idx" ON "courses_blocks_course_image" USING btree ("_parent_id");
CREATE INDEX "courses_blocks_course_image_path_idx" ON "courses_blocks_course_image" USING btree ("_path");
CREATE INDEX "courses_blocks_course_image_image_idx" ON "courses_blocks_course_image" USING btree ("image_id");
CREATE INDEX "courses_blocks_course_video_order_idx" ON "courses_blocks_course_video" USING btree ("_order");
CREATE INDEX "courses_blocks_course_video_parent_id_idx" ON "courses_blocks_course_video" USING btree ("_parent_id");
CREATE INDEX "courses_blocks_course_video_path_idx" ON "courses_blocks_course_video" USING btree ("_path");
CREATE INDEX "courses_lessons_order_idx" ON "courses_lessons" USING btree ("_order");
CREATE INDEX "courses_lessons_parent_id_idx" ON "courses_lessons" USING btree ("_parent_id");
CREATE UNIQUE INDEX "courses_slug_idx" ON "courses" USING btree ("slug");
CREATE INDEX "courses_updated_at_idx" ON "courses" USING btree ("updated_at");
CREATE INDEX "courses_created_at_idx" ON "courses" USING btree ("created_at");
CREATE INDEX "courses__status_idx" ON "courses" USING btree ("_status");
CREATE INDEX "_courses_v_blocks_course_teaching_order_idx" ON "_courses_v_blocks_course_teaching" USING btree ("_order");
CREATE INDEX "_courses_v_blocks_course_teaching_parent_id_idx" ON "_courses_v_blocks_course_teaching" USING btree ("_parent_id");
CREATE INDEX "_courses_v_blocks_course_teaching_path_idx" ON "_courses_v_blocks_course_teaching" USING btree ("_path");
CREATE INDEX "_courses_v_blocks_course_image_order_idx" ON "_courses_v_blocks_course_image" USING btree ("_order");
CREATE INDEX "_courses_v_blocks_course_image_parent_id_idx" ON "_courses_v_blocks_course_image" USING btree ("_parent_id");
CREATE INDEX "_courses_v_blocks_course_image_path_idx" ON "_courses_v_blocks_course_image" USING btree ("_path");
CREATE INDEX "_courses_v_blocks_course_image_image_idx" ON "_courses_v_blocks_course_image" USING btree ("image_id");
CREATE INDEX "_courses_v_blocks_course_video_order_idx" ON "_courses_v_blocks_course_video" USING btree ("_order");
CREATE INDEX "_courses_v_blocks_course_video_parent_id_idx" ON "_courses_v_blocks_course_video" USING btree ("_parent_id");
CREATE INDEX "_courses_v_blocks_course_video_path_idx" ON "_courses_v_blocks_course_video" USING btree ("_path");
CREATE INDEX "_courses_v_version_lessons_order_idx" ON "_courses_v_version_lessons" USING btree ("_order");
CREATE INDEX "_courses_v_version_lessons_parent_id_idx" ON "_courses_v_version_lessons" USING btree ("_parent_id");
CREATE INDEX "_courses_v_parent_idx" ON "_courses_v" USING btree ("parent_id");
CREATE INDEX "_courses_v_version_version_slug_idx" ON "_courses_v" USING btree ("version_slug");
CREATE INDEX "_courses_v_version_version_updated_at_idx" ON "_courses_v" USING btree ("version_updated_at");
CREATE INDEX "_courses_v_version_version_created_at_idx" ON "_courses_v" USING btree ("version_created_at");
CREATE INDEX "_courses_v_version_version__status_idx" ON "_courses_v" USING btree ("version__status");
CREATE INDEX "_courses_v_created_at_idx" ON "_courses_v" USING btree ("created_at");
CREATE INDEX "_courses_v_updated_at_idx" ON "_courses_v" USING btree ("updated_at");
CREATE INDEX "_courses_v_latest_idx" ON "_courses_v" USING btree ("latest");
CREATE INDEX "course_editions_course_idx" ON "course_editions" USING btree ("course_id");
CREATE INDEX "course_editions_structure_key_idx" ON "course_editions" USING btree ("structure_key");
CREATE INDEX "course_editions_updated_at_idx" ON "course_editions" USING btree ("updated_at");
CREATE INDEX "course_editions_created_at_idx" ON "course_editions" USING btree ("created_at");
CREATE INDEX "course_attempts_account_key_idx" ON "course_attempts" USING btree ("account_key");
CREATE INDEX "course_attempts_edition_idx" ON "course_attempts" USING btree ("edition_id");
CREATE INDEX "course_attempts_completed_at_idx" ON "course_attempts" USING btree ("completed_at");
CREATE INDEX "course_attempts_updated_at_idx" ON "course_attempts" USING btree ("updated_at");
CREATE INDEX "course_attempts_created_at_idx" ON "course_attempts" USING btree ("created_at");
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_course_editions_fk" FOREIGN KEY ("course_editions_id") REFERENCES "public"."course_editions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_course_attempts_fk" FOREIGN KEY ("course_attempts_id") REFERENCES "public"."course_attempts"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "payload_locked_documents_rels_courses_id_idx" ON "payload_locked_documents_rels" USING btree ("courses_id");
CREATE INDEX "payload_locked_documents_rels_course_editions_id_idx" ON "payload_locked_documents_rels" USING btree ("course_editions_id");
CREATE INDEX "payload_locked_documents_rels_course_attempts_id_idx" ON "payload_locked_documents_rels" USING btree ("course_attempts_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "courses_find";
ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "courses_create";
ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "courses_update";
ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "courses_delete";
ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "courses_id" CASCADE;
ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "course_editions_id" CASCADE;
ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "course_attempts_id" CASCADE;
DROP TABLE IF EXISTS "course_attempts", "course_editions", "courses_blocks_course_teaching", "courses_blocks_course_image", "courses_blocks_course_video", "courses_lessons", "_courses_v_blocks_course_teaching", "_courses_v_blocks_course_image", "_courses_v_blocks_course_video", "_courses_v_version_lessons", "_courses_v", "courses" CASCADE;
DROP TYPE IF EXISTS "enum_courses_status", "enum__courses_v_version_status", "enum_course_attempts_mode";
  `)
}
