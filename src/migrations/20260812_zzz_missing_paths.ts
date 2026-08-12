import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE "missing_paths" (
    "id" serial PRIMARY KEY NOT NULL,
    "path" varchar NOT NULL,
    "count" numeric DEFAULT 0 NOT NULL,
    "destination" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "missing_paths_id" integer;
  CREATE UNIQUE INDEX "missing_paths_path_idx" ON "missing_paths" USING btree ("path");
  CREATE INDEX "missing_paths_updated_at_idx" ON "missing_paths" USING btree ("updated_at");
  CREATE INDEX "missing_paths_created_at_idx" ON "missing_paths" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_missing_paths_fk" FOREIGN KEY ("missing_paths_id") REFERENCES "public"."missing_paths"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_missing_paths_id_idx" ON "payload_locked_documents_rels" USING btree ("missing_paths_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_missing_paths_fk";
  DROP INDEX "payload_locked_documents_rels_missing_paths_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "missing_paths_id";
  ALTER TABLE "missing_paths" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "missing_paths" CASCADE;`)
}
