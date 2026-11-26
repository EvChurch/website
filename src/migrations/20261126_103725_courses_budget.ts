import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_courses_blocks_course_budget_visibility" AS ENUM('personal', 'shared');
  CREATE TYPE "public"."enum_courses_blocks_course_budget_response_mode" AS ENUM('group', 'individual');
  CREATE TYPE "public"."enum__courses_v_blocks_course_budget_visibility" AS ENUM('personal', 'shared');
  CREATE TYPE "public"."enum__courses_v_blocks_course_budget_response_mode" AS ENUM('group', 'individual');
  CREATE TABLE "courses_blocks_course_budget_categories" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"category_id" varchar,
  	"label" varchar,
  	"starting_lines" varchar
  );
  
  CREATE TABLE "courses_blocks_course_budget" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Your weekly budget',
  	"instructions" varchar,
  	"visibility" "enum_courses_blocks_course_budget_visibility" DEFAULT 'personal',
  	"response_mode" "enum_courses_blocks_course_budget_response_mode" DEFAULT 'group',
  	"required" boolean DEFAULT false,
  	"block_name" varchar
  );
  
  CREATE TABLE "_courses_v_blocks_course_budget_categories" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"category_id" varchar,
  	"label" varchar,
  	"starting_lines" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_courses_v_blocks_course_budget" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'Your weekly budget',
  	"instructions" varchar,
  	"visibility" "enum__courses_v_blocks_course_budget_visibility" DEFAULT 'personal',
  	"response_mode" "enum__courses_v_blocks_course_budget_response_mode" DEFAULT 'group',
  	"required" boolean DEFAULT false,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "courses_blocks_course_budget_categories" ADD CONSTRAINT "courses_blocks_course_budget_categories_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_blocks_course_budget"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_course_budget" ADD CONSTRAINT "courses_blocks_course_budget_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_course_budget_categories" ADD CONSTRAINT "_courses_v_blocks_course_budget_categories_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_blocks_course_budget"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_course_budget" ADD CONSTRAINT "_courses_v_blocks_course_budget_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "courses_blocks_course_budget_categories_order_idx" ON "courses_blocks_course_budget_categories" USING btree ("_order");
  CREATE INDEX "courses_blocks_course_budget_categories_parent_id_idx" ON "courses_blocks_course_budget_categories" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_course_budget_order_idx" ON "courses_blocks_course_budget" USING btree ("_order");
  CREATE INDEX "courses_blocks_course_budget_parent_id_idx" ON "courses_blocks_course_budget" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_course_budget_path_idx" ON "courses_blocks_course_budget" USING btree ("_path");
  CREATE INDEX "_courses_v_blocks_course_budget_categories_order_idx" ON "_courses_v_blocks_course_budget_categories" USING btree ("_order");
  CREATE INDEX "_courses_v_blocks_course_budget_categories_parent_id_idx" ON "_courses_v_blocks_course_budget_categories" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_course_budget_order_idx" ON "_courses_v_blocks_course_budget" USING btree ("_order");
  CREATE INDEX "_courses_v_blocks_course_budget_parent_id_idx" ON "_courses_v_blocks_course_budget" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_course_budget_path_idx" ON "_courses_v_blocks_course_budget" USING btree ("_path");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "courses_blocks_course_budget_categories" CASCADE;
  DROP TABLE "courses_blocks_course_budget" CASCADE;
  DROP TABLE "_courses_v_blocks_course_budget_categories" CASCADE;
  DROP TABLE "_courses_v_blocks_course_budget" CASCADE;
  DROP TYPE "public"."enum_courses_blocks_course_budget_visibility";
  DROP TYPE "public"."enum_courses_blocks_course_budget_response_mode";
  DROP TYPE "public"."enum__courses_v_blocks_course_budget_visibility";
  DROP TYPE "public"."enum__courses_v_blocks_course_budget_response_mode";`)
}
