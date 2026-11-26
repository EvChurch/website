import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_courses_blocks_course_question_visibility" AS ENUM('personal', 'shared');
  CREATE TYPE "public"."enum_courses_blocks_course_question_response_mode" AS ENUM('group', 'individual');
  CREATE TYPE "public"."enum_courses_blocks_course_question_input_type" AS ENUM('text', 'number', 'choice', 'checklist');
  CREATE TYPE "public"."enum__courses_v_blocks_course_question_visibility" AS ENUM('personal', 'shared');
  CREATE TYPE "public"."enum__courses_v_blocks_course_question_response_mode" AS ENUM('group', 'individual');
  CREATE TYPE "public"."enum__courses_v_blocks_course_question_input_type" AS ENUM('text', 'number', 'choice', 'checklist');
  CREATE TYPE "public"."enum_course_answers_scope" AS ENUM('personal', 'individual-shared', 'group');
  CREATE TABLE "courses_blocks_course_question_choices" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"choice_id" varchar,
  	"label" varchar
  );
  
  CREATE TABLE "courses_blocks_course_question" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"prompt" varchar,
  	"guidance" varchar,
  	"visibility" "enum_courses_blocks_course_question_visibility" DEFAULT 'personal',
  	"response_mode" "enum_courses_blocks_course_question_response_mode" DEFAULT 'group',
  	"required" boolean DEFAULT false,
  	"input_type" "enum_courses_blocks_course_question_input_type" DEFAULT 'text',
  	"block_name" varchar
  );
  
  CREATE TABLE "courses_blocks_course_prompt" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"prompt" varchar,
  	"guidance" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_courses_v_blocks_course_question_choices" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"choice_id" varchar,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_courses_v_blocks_course_question" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"prompt" varchar,
  	"guidance" varchar,
  	"visibility" "enum__courses_v_blocks_course_question_visibility" DEFAULT 'personal',
  	"response_mode" "enum__courses_v_blocks_course_question_response_mode" DEFAULT 'group',
  	"required" boolean DEFAULT false,
  	"input_type" "enum__courses_v_blocks_course_question_input_type" DEFAULT 'text',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_courses_v_blocks_course_prompt" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"prompt" varchar,
  	"guidance" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "course_answers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"response_key" varchar NOT NULL,
  	"attempt_id" integer NOT NULL,
  	"edition_id" integer NOT NULL,
  	"lesson_id" varchar NOT NULL,
  	"block_id" varchar NOT NULL,
  	"owner_key" varchar NOT NULL,
  	"scope" "enum_course_answers_scope" NOT NULL,
  	"value" jsonb,
  	"revision" numeric DEFAULT 1 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "course_answers_id" integer;
  ALTER TABLE "courses_blocks_course_question_choices" ADD CONSTRAINT "courses_blocks_course_question_choices_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_blocks_course_question"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_course_question" ADD CONSTRAINT "courses_blocks_course_question_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_course_prompt" ADD CONSTRAINT "courses_blocks_course_prompt_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_course_question_choices" ADD CONSTRAINT "_courses_v_blocks_course_question_choices_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_blocks_course_question"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_course_question" ADD CONSTRAINT "_courses_v_blocks_course_question_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_course_prompt" ADD CONSTRAINT "_courses_v_blocks_course_prompt_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "course_answers" ADD CONSTRAINT "course_answers_attempt_id_course_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."course_attempts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "course_answers" ADD CONSTRAINT "course_answers_edition_id_course_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."course_editions"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "courses_blocks_course_question_choices_order_idx" ON "courses_blocks_course_question_choices" USING btree ("_order");
  CREATE INDEX "courses_blocks_course_question_choices_parent_id_idx" ON "courses_blocks_course_question_choices" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_course_question_order_idx" ON "courses_blocks_course_question" USING btree ("_order");
  CREATE INDEX "courses_blocks_course_question_parent_id_idx" ON "courses_blocks_course_question" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_course_question_path_idx" ON "courses_blocks_course_question" USING btree ("_path");
  CREATE INDEX "courses_blocks_course_prompt_order_idx" ON "courses_blocks_course_prompt" USING btree ("_order");
  CREATE INDEX "courses_blocks_course_prompt_parent_id_idx" ON "courses_blocks_course_prompt" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_course_prompt_path_idx" ON "courses_blocks_course_prompt" USING btree ("_path");
  CREATE INDEX "_courses_v_blocks_course_question_choices_order_idx" ON "_courses_v_blocks_course_question_choices" USING btree ("_order");
  CREATE INDEX "_courses_v_blocks_course_question_choices_parent_id_idx" ON "_courses_v_blocks_course_question_choices" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_course_question_order_idx" ON "_courses_v_blocks_course_question" USING btree ("_order");
  CREATE INDEX "_courses_v_blocks_course_question_parent_id_idx" ON "_courses_v_blocks_course_question" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_course_question_path_idx" ON "_courses_v_blocks_course_question" USING btree ("_path");
  CREATE INDEX "_courses_v_blocks_course_prompt_order_idx" ON "_courses_v_blocks_course_prompt" USING btree ("_order");
  CREATE INDEX "_courses_v_blocks_course_prompt_parent_id_idx" ON "_courses_v_blocks_course_prompt" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_course_prompt_path_idx" ON "_courses_v_blocks_course_prompt" USING btree ("_path");
  CREATE UNIQUE INDEX "course_answers_response_key_idx" ON "course_answers" USING btree ("response_key");
  CREATE INDEX "course_answers_attempt_idx" ON "course_answers" USING btree ("attempt_id");
  CREATE INDEX "course_answers_edition_idx" ON "course_answers" USING btree ("edition_id");
  CREATE INDEX "course_answers_owner_key_idx" ON "course_answers" USING btree ("owner_key");
  CREATE INDEX "course_answers_updated_at_idx" ON "course_answers" USING btree ("updated_at");
  CREATE INDEX "course_answers_created_at_idx" ON "course_answers" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_course_answers_fk" FOREIGN KEY ("course_answers_id") REFERENCES "public"."course_answers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_course_answers_id_idx" ON "payload_locked_documents_rels" USING btree ("course_answers_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_course_answers_fk";
  DROP INDEX "payload_locked_documents_rels_course_answers_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "course_answers_id";
   ALTER TABLE "courses_blocks_course_question_choices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_course_question" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_course_prompt" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_course_question_choices" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_course_question" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_course_prompt" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "course_answers" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "courses_blocks_course_question_choices" CASCADE;
  DROP TABLE "courses_blocks_course_question" CASCADE;
  DROP TABLE "courses_blocks_course_prompt" CASCADE;
  DROP TABLE "_courses_v_blocks_course_question_choices" CASCADE;
  DROP TABLE "_courses_v_blocks_course_question" CASCADE;
  DROP TABLE "_courses_v_blocks_course_prompt" CASCADE;
  DROP TABLE "course_answers" CASCADE;

  


  DROP TYPE "public"."enum_courses_blocks_course_question_visibility";
  DROP TYPE "public"."enum_courses_blocks_course_question_response_mode";
  DROP TYPE "public"."enum_courses_blocks_course_question_input_type";
  DROP TYPE "public"."enum__courses_v_blocks_course_question_visibility";
  DROP TYPE "public"."enum__courses_v_blocks_course_question_response_mode";
  DROP TYPE "public"."enum__courses_v_blocks_course_question_input_type";
  DROP TYPE "public"."enum_course_answers_scope";`)
}
