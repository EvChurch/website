import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    SET LOCAL lock_timeout = '5s';
    SET LOCAL statement_timeout = '30s';

    CREATE TYPE "public"."enum_rock_forms_form_type" AS ENUM('workflow', 'registrationPage');

    ALTER TABLE "rock_forms"
      ADD COLUMN "form_type" "enum_rock_forms_form_type" DEFAULT 'workflow' NOT NULL,
      ADD COLUMN "registration_path" varchar,
      ALTER COLUMN "workflow_type_guid" DROP NOT NULL,
      ALTER COLUMN "rock_form_name" DROP NOT NULL;

    CREATE UNIQUE INDEX "rock_forms_registration_path_idx"
      ON "rock_forms" USING btree ("registration_path");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    SET LOCAL lock_timeout = '5s';
    SET LOCAL statement_timeout = '30s';

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM "rock_forms" WHERE "form_type" = 'registrationPage'
      ) THEN
        RAISE EXCEPTION 'Cannot roll back while Registration page Rock Forms exist';
      END IF;
    END $$;

    DROP INDEX IF EXISTS "rock_forms_registration_path_idx";
    ALTER TABLE "rock_forms"
      DROP COLUMN "registration_path",
      ALTER COLUMN "workflow_type_guid" SET NOT NULL,
      ALTER COLUMN "rock_form_name" SET NOT NULL,
      DROP COLUMN "form_type";
    DROP TYPE "public"."enum_rock_forms_form_type";
  `))
}
