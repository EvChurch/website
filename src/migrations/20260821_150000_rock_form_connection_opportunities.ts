import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    SET LOCAL lock_timeout = '5s';
    SET LOCAL statement_timeout = '30s';

    ALTER TYPE "public"."enum_rock_forms_form_type"
      ADD VALUE IF NOT EXISTS 'connectionOpportunity';

    ALTER TABLE "rock_forms"
      ADD COLUMN IF NOT EXISTS "connection_block_guid" varchar;

    CREATE UNIQUE INDEX IF NOT EXISTS "rock_forms_connection_block_guid_idx"
      ON "rock_forms" USING btree ("connection_block_guid");
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    SET LOCAL lock_timeout = '5s';
    SET LOCAL statement_timeout = '30s';

    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM "rock_forms" WHERE "form_type" = 'connectionOpportunity'
      ) THEN
        RAISE EXCEPTION 'Cannot roll back while Connection Opportunity Rock Forms exist';
      END IF;
    END $$;

    DROP INDEX IF EXISTS "rock_forms_connection_block_guid_idx";
    ALTER TABLE "rock_forms" DROP COLUMN "connection_block_guid";

    ALTER TABLE "rock_forms" ALTER COLUMN "form_type" DROP DEFAULT;
    ALTER TYPE "public"."enum_rock_forms_form_type" RENAME TO "enum_rock_forms_form_type_old";
    CREATE TYPE "public"."enum_rock_forms_form_type" AS ENUM('workflow', 'registrationPage');
    ALTER TABLE "rock_forms"
      ALTER COLUMN "form_type" TYPE "public"."enum_rock_forms_form_type"
      USING "form_type"::text::"public"."enum_rock_forms_form_type",
      ALTER COLUMN "form_type" SET DEFAULT 'workflow';
    DROP TYPE "public"."enum_rock_forms_form_type_old";
  `))
}
