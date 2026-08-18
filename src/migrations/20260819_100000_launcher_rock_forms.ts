import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    SET LOCAL lock_timeout = '5s';
    SET LOCAL statement_timeout = '30s';

    CREATE TABLE "rock_forms" (
      "id" serial PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "image_id" integer,
      "body" jsonb,
      "workflow_type_guid" varchar NOT NULL,
      "rock_form_name" varchar NOT NULL,
      "published" boolean DEFAULT false,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "rock_forms"
      ADD CONSTRAINT "rock_forms_image_id_media_id_fk"
      FOREIGN KEY ("image_id") REFERENCES "public"."media"("id")
      ON DELETE set null ON UPDATE no action;

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "rock_forms_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_rock_forms_fk"
      FOREIGN KEY ("rock_forms_id") REFERENCES "public"."rock_forms"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE UNIQUE INDEX "rock_forms_slug_idx" ON "rock_forms" USING btree ("slug");
    CREATE INDEX "rock_forms_image_idx" ON "rock_forms" USING btree ("image_id");
    CREATE UNIQUE INDEX "rock_forms_workflow_type_guid_idx" ON "rock_forms" USING btree ("workflow_type_guid");
    CREATE INDEX "rock_forms_updated_at_idx" ON "rock_forms" USING btree ("updated_at");
    CREATE INDEX "rock_forms_created_at_idx" ON "rock_forms" USING btree ("created_at");
    CREATE INDEX "payload_locked_documents_rels_rock_forms_id_idx"
      ON "payload_locked_documents_rels" USING btree ("rock_forms_id");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    SET LOCAL lock_timeout = '5s';
    SET LOCAL statement_timeout = '30s';

    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM "rock_forms") THEN
        RAISE EXCEPTION 'Cannot roll back while Rock Forms content exists';
      END IF;
    END $$;

    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_rock_forms_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_rock_forms_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "rock_forms_id";
    DROP TABLE IF EXISTS "rock_forms" CASCADE;
  `))
}
