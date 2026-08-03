import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_form_embed" ADD COLUMN IF NOT EXISTS "rock_workflow_guid" varchar;
  ALTER TABLE "_pages_v_blocks_form_embed" ADD COLUMN IF NOT EXISTS "rock_workflow_guid" varchar;
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM "pages_blocks_form_embed"
      WHERE "rock_workflow_guid" IS NULL
        AND NOT (
          "form_type" = 'contact'
          OR ("form_type" = 'signup' AND lower(coalesce("form_title", '')) IN ('newish connect', 'explaining christianity'))
        )
    ) OR EXISTS (
      SELECT 1 FROM "_pages_v_blocks_form_embed"
      WHERE "rock_workflow_guid" IS NULL
        AND NOT (
          "form_type" = 'contact'
          OR ("form_type" = 'signup' AND lower(coalesce("form_title", '')) IN ('newish connect', 'explaining christianity'))
        )
    ) THEN
      RAISE EXCEPTION 'Unknown legacy form embed mapping; choose a Rock workflow before migrating';
    END IF;
  END $$;
  UPDATE "pages_blocks_form_embed"
  SET "rock_workflow_guid" = CASE
    WHEN "form_type" = 'contact' THEN '874418b5-a477-4382-94dc-38060b005bfa'
    WHEN lower(coalesce("form_title", '')) = 'explaining christianity' THEN '16d675d3-00cf-459e-990d-817003cbbc88'
    WHEN lower(coalesce("form_title", '')) = 'newish connect' THEN '00778880-81fe-4871-aa91-7c81783b8c4d'
    ELSE "rock_workflow_guid"
  END;
  UPDATE "_pages_v_blocks_form_embed"
  SET "rock_workflow_guid" = CASE
    WHEN "form_type" = 'contact' THEN '874418b5-a477-4382-94dc-38060b005bfa'
    WHEN lower(coalesce("form_title", '')) = 'explaining christianity' THEN '16d675d3-00cf-459e-990d-817003cbbc88'
    WHEN lower(coalesce("form_title", '')) = 'newish connect' THEN '00778880-81fe-4871-aa91-7c81783b8c4d'
    ELSE "rock_workflow_guid"
  END;
  ALTER TABLE "pages_blocks_form_embed" DROP COLUMN "form_type";
  ALTER TABLE "pages_blocks_form_embed" DROP COLUMN "form_title";
  ALTER TABLE "_pages_v_blocks_form_embed" DROP COLUMN "form_type";
  ALTER TABLE "_pages_v_blocks_form_embed" DROP COLUMN "form_title";
  DROP TYPE "public"."enum_pages_blocks_form_embed_form_type";
  DROP TYPE "public"."enum__pages_v_blocks_form_embed_form_type";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_pages_blocks_form_embed_form_type" AS ENUM('contact', 'signup');
  CREATE TYPE "public"."enum__pages_v_blocks_form_embed_form_type" AS ENUM('contact', 'signup');
  ALTER TABLE "pages_blocks_form_embed" ADD COLUMN "form_type" "enum_pages_blocks_form_embed_form_type";
  ALTER TABLE "pages_blocks_form_embed" ADD COLUMN "form_title" varchar;
  ALTER TABLE "_pages_v_blocks_form_embed" ADD COLUMN "form_type" "enum__pages_v_blocks_form_embed_form_type";
  ALTER TABLE "_pages_v_blocks_form_embed" ADD COLUMN "form_title" varchar;
  UPDATE "pages_blocks_form_embed"
  SET
    "form_type" = CASE WHEN "rock_workflow_guid" = '874418b5-a477-4382-94dc-38060b005bfa' THEN 'contact'::"enum_pages_blocks_form_embed_form_type" ELSE 'signup'::"enum_pages_blocks_form_embed_form_type" END,
    "form_title" = CASE
      WHEN "rock_workflow_guid" = '16d675d3-00cf-459e-990d-817003cbbc88' THEN 'Explaining Christianity'
      WHEN "rock_workflow_guid" = '00778880-81fe-4871-aa91-7c81783b8c4d' THEN 'Newish Connect'
      ELSE NULL
    END;
  UPDATE "_pages_v_blocks_form_embed"
  SET
    "form_type" = CASE WHEN "rock_workflow_guid" = '874418b5-a477-4382-94dc-38060b005bfa' THEN 'contact'::"enum__pages_v_blocks_form_embed_form_type" ELSE 'signup'::"enum__pages_v_blocks_form_embed_form_type" END,
    "form_title" = CASE
      WHEN "rock_workflow_guid" = '16d675d3-00cf-459e-990d-817003cbbc88' THEN 'Explaining Christianity'
      WHEN "rock_workflow_guid" = '00778880-81fe-4871-aa91-7c81783b8c4d' THEN 'Newish Connect'
      ELSE NULL
    END;
  -- Keep rock_workflow_guid so a rollback and later re-up does not discard
  -- workflows that cannot be represented by the legacy contact/signup fields.
  `)
}
