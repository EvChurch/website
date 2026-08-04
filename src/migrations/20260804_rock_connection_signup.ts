import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

import { NEWISH_CONNECTION_BLOCK_GUID } from '@/seed/newish-form'
import {
  EXPLAINING_CHRISTIANITY_CONNECTION_BLOCK_GUID,
  OLD_EXPLAINING_CHRISTIANITY_WORKFLOW_GUID,
} from '@/seed/explaining-christianity-form'

export const ROCK_CONNECTION_SIGNUP_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_pages_blocks_form_embed_source_type') THEN
    CREATE TYPE "public"."enum_pages_blocks_form_embed_source_type" AS ENUM ('workflow', 'connectionOpportunity');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum__pages_v_blocks_form_embed_source_type') THEN
    CREATE TYPE "public"."enum__pages_v_blocks_form_embed_source_type" AS ENUM ('workflow', 'connectionOpportunity');
  END IF;
END $$;

ALTER TABLE "pages_blocks_form_embed"
  ADD COLUMN IF NOT EXISTS "source_type" "public"."enum_pages_blocks_form_embed_source_type",
  ADD COLUMN IF NOT EXISTS "rock_connection_block_guid" varchar;
ALTER TABLE "_pages_v_blocks_form_embed"
  ADD COLUMN IF NOT EXISTS "source_type" "public"."enum__pages_v_blocks_form_embed_source_type",
  ADD COLUMN IF NOT EXISTS "rock_connection_block_guid" varchar;

ALTER TABLE "pages_blocks_form_embed" ALTER COLUMN "source_type" SET DEFAULT 'workflow';
ALTER TABLE "_pages_v_blocks_form_embed" ALTER COLUMN "source_type" SET DEFAULT 'workflow';
UPDATE "pages_blocks_form_embed"
SET "source_type" = 'workflow'
WHERE "source_type" IS NULL;
UPDATE "_pages_v_blocks_form_embed"
SET "source_type" = 'workflow'
WHERE "source_type" IS NULL;

DO $$
DECLARE
  live_old_guid_count integer;
  live_candidate_count integer;
  version_old_guid_count integer;
  version_candidate_count integer;
  candidate_manifest jsonb;
BEGIN
  SELECT count(*) INTO live_old_guid_count
  FROM "pages_blocks_form_embed" b
  JOIN "pages" p ON p."id" = b."_parent_id"
  WHERE lower(p."slug") = 'newish'
    AND lower(coalesce(b."rock_workflow_guid", '')) = '00778880-81fe-4871-aa91-7c81783b8c4d';

  SELECT count(*) INTO live_candidate_count
  FROM "pages_blocks_form_embed" b
  JOIN "pages" p ON p."id" = b."_parent_id"
  WHERE lower(p."slug") = 'newish'
    AND lower(coalesce(b."rock_workflow_guid", '')) = '00778880-81fe-4871-aa91-7c81783b8c4d'
    AND b."_path" = 'layout'
    AND b."_order" = 5
    AND b."layout"::text = 'centered';

  SELECT count(*) INTO version_old_guid_count
  FROM "_pages_v_blocks_form_embed" b
  JOIN "_pages_v" v ON v."id" = b."_parent_id"
  WHERE lower(v."version_slug") = 'newish'
    AND lower(coalesce(b."rock_workflow_guid", '')) = '00778880-81fe-4871-aa91-7c81783b8c4d';

  SELECT count(*) INTO version_candidate_count
  FROM "_pages_v_blocks_form_embed" b
  JOIN "_pages_v" v ON v."id" = b."_parent_id"
  WHERE lower(v."version_slug") = 'newish'
    AND lower(coalesce(b."rock_workflow_guid", '')) = '00778880-81fe-4871-aa91-7c81783b8c4d'
    AND b."_path" = 'version.layout'
    AND b."_order" = 5
    AND b."layout"::text = 'centered';

  SELECT coalesce(jsonb_agg(candidate ORDER BY candidate->>'scope', candidate->>'parentId'), '[]'::jsonb)
  INTO candidate_manifest
  FROM (
    SELECT jsonb_build_object(
      'scope', 'live',
      'childId', b."id",
      'parentId', p."id",
      'path', b."_path",
      'order', b."_order",
      'layout', b."layout"::text,
      'oldGuid', b."rock_workflow_guid",
      'latest', NULL
    ) AS candidate
    FROM "pages_blocks_form_embed" b
    JOIN "pages" p ON p."id" = b."_parent_id"
    WHERE lower(p."slug") = 'newish'
      AND lower(coalesce(b."rock_workflow_guid", '')) = '00778880-81fe-4871-aa91-7c81783b8c4d'
    UNION ALL
    SELECT jsonb_build_object(
      'scope', 'version',
      'childId', b."id",
      'parentId', v."id",
      'pageId', v."parent_id",
      'path', b."_path",
      'order', b."_order",
      'layout', b."layout"::text,
      'oldGuid', b."rock_workflow_guid",
      'latest', v."latest"
    ) AS candidate
    FROM "_pages_v_blocks_form_embed" b
    JOIN "_pages_v" v ON v."id" = b."_parent_id"
    WHERE lower(v."version_slug") = 'newish'
      AND lower(coalesce(b."rock_workflow_guid", '')) = '00778880-81fe-4871-aa91-7c81783b8c4d'
  ) manifest_rows;
  RAISE NOTICE 'Rock Connection Signup candidate manifest: %', candidate_manifest;

  IF live_candidate_count > 1 OR live_candidate_count <> live_old_guid_count THEN
    RAISE EXCEPTION 'Unsafe live Newish form candidate set: % reviewed of % matching old GUID', live_candidate_count, live_old_guid_count;
  END IF;
  IF version_candidate_count <> version_old_guid_count THEN
    RAISE EXCEPTION 'Unsafe version Newish form candidate set: % reviewed of % matching old GUID', version_candidate_count, version_old_guid_count;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "_pages_v_blocks_form_embed" b
    JOIN "_pages_v" v ON v."id" = b."_parent_id"
    WHERE lower(v."version_slug") = 'newish'
      AND lower(coalesce(b."rock_workflow_guid", '')) = '00778880-81fe-4871-aa91-7c81783b8c4d'
      AND b."_path" = 'version.layout'
      AND b."_order" = 5
      AND b."layout"::text = 'centered'
    GROUP BY b."_parent_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate Newish form candidates exist in one page version';
  END IF;
END $$;

UPDATE "pages_blocks_form_embed" b
SET "source_type" = 'connectionOpportunity',
    "rock_connection_block_guid" = '${NEWISH_CONNECTION_BLOCK_GUID}',
    "rock_workflow_guid" = NULL
FROM "pages" p
WHERE p."id" = b."_parent_id"
  AND lower(p."slug") = 'newish'
  AND lower(coalesce(b."rock_workflow_guid", '')) = '00778880-81fe-4871-aa91-7c81783b8c4d'
  AND b."_path" = 'layout'
  AND b."_order" = 5
  AND b."layout"::text = 'centered';

UPDATE "_pages_v_blocks_form_embed" b
SET "source_type" = 'connectionOpportunity',
    "rock_connection_block_guid" = '${NEWISH_CONNECTION_BLOCK_GUID}',
    "rock_workflow_guid" = NULL
FROM "_pages_v" v
WHERE v."id" = b."_parent_id"
  AND lower(v."version_slug") = 'newish'
  AND lower(coalesce(b."rock_workflow_guid", '')) = '00778880-81fe-4871-aa91-7c81783b8c4d'
  AND b."_path" = 'version.layout'
  AND b."_order" = 5
  AND b."layout"::text = 'centered';

DO $$
DECLARE
  live_old_guid_count integer;
  live_candidate_count integer;
  version_old_guid_count integer;
  version_candidate_count integer;
BEGIN
  SELECT count(*) INTO live_old_guid_count
  FROM "pages_blocks_form_embed" b
  JOIN "pages" p ON p."id" = b."_parent_id"
  WHERE lower(p."slug") = 'explaining-christianity'
    AND lower(coalesce(b."rock_workflow_guid", '')) = '${OLD_EXPLAINING_CHRISTIANITY_WORKFLOW_GUID}';

  SELECT count(*) INTO live_candidate_count
  FROM "pages_blocks_form_embed" b
  JOIN "pages" p ON p."id" = b."_parent_id"
  WHERE lower(p."slug") = 'explaining-christianity'
    AND lower(coalesce(b."rock_workflow_guid", '')) = '${OLD_EXPLAINING_CHRISTIANITY_WORKFLOW_GUID}'
    AND b."_path" = 'layout'
    AND b."_order" = 5
    AND b."layout"::text = 'centered';

  SELECT count(*) INTO version_old_guid_count
  FROM "_pages_v_blocks_form_embed" b
  JOIN "_pages_v" v ON v."id" = b."_parent_id"
  WHERE lower(v."version_slug") = 'explaining-christianity'
    AND lower(coalesce(b."rock_workflow_guid", '')) = '${OLD_EXPLAINING_CHRISTIANITY_WORKFLOW_GUID}';

  SELECT count(*) INTO version_candidate_count
  FROM "_pages_v_blocks_form_embed" b
  JOIN "_pages_v" v ON v."id" = b."_parent_id"
  WHERE lower(v."version_slug") = 'explaining-christianity'
    AND lower(coalesce(b."rock_workflow_guid", '')) = '${OLD_EXPLAINING_CHRISTIANITY_WORKFLOW_GUID}'
    AND b."_path" = 'version.layout'
    AND b."_order" = 5
    AND b."layout"::text = 'centered';

  RAISE NOTICE 'Rock Explaining Christianity candidate manifest: live=%/% versions=%/%',
    live_candidate_count, live_old_guid_count,
    version_candidate_count, version_old_guid_count;

  IF live_candidate_count > 1 OR live_candidate_count <> live_old_guid_count THEN
    RAISE EXCEPTION 'Unsafe live Explaining Christianity form candidate set: % reviewed of % matching old GUID', live_candidate_count, live_old_guid_count;
  END IF;
  IF version_candidate_count <> version_old_guid_count THEN
    RAISE EXCEPTION 'Unsafe version Explaining Christianity form candidate set: % reviewed of % matching old GUID', version_candidate_count, version_old_guid_count;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM "_pages_v_blocks_form_embed" b
    JOIN "_pages_v" v ON v."id" = b."_parent_id"
    WHERE lower(v."version_slug") = 'explaining-christianity'
      AND lower(coalesce(b."rock_workflow_guid", '')) = '${OLD_EXPLAINING_CHRISTIANITY_WORKFLOW_GUID}'
      AND b."_path" = 'version.layout'
      AND b."_order" = 5
      AND b."layout"::text = 'centered'
    GROUP BY b."_parent_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate Explaining Christianity form candidates exist in one page version';
  END IF;
END $$;

UPDATE "pages_blocks_form_embed" b
SET "source_type" = 'connectionOpportunity',
    "rock_connection_block_guid" = '${EXPLAINING_CHRISTIANITY_CONNECTION_BLOCK_GUID}',
    "rock_workflow_guid" = NULL
FROM "pages" p
WHERE p."id" = b."_parent_id"
  AND lower(p."slug") = 'explaining-christianity'
  AND lower(coalesce(b."rock_workflow_guid", '')) = '${OLD_EXPLAINING_CHRISTIANITY_WORKFLOW_GUID}'
  AND b."_path" = 'layout'
  AND b."_order" = 5
  AND b."layout"::text = 'centered';

UPDATE "_pages_v_blocks_form_embed" b
SET "source_type" = 'connectionOpportunity',
    "rock_connection_block_guid" = '${EXPLAINING_CHRISTIANITY_CONNECTION_BLOCK_GUID}',
    "rock_workflow_guid" = NULL
FROM "_pages_v" v
WHERE v."id" = b."_parent_id"
  AND lower(v."version_slug") = 'explaining-christianity'
  AND lower(coalesce(b."rock_workflow_guid", '')) = '${OLD_EXPLAINING_CHRISTIANITY_WORKFLOW_GUID}'
  AND b."_path" = 'version.layout'
  AND b."_order" = 5
  AND b."layout"::text = 'centered';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "pages_blocks_form_embed"
    WHERE "source_type" IS NULL
       OR NOT (
         ("source_type"::text = 'workflow'
           AND "rock_workflow_guid" IS NOT NULL
           AND "rock_workflow_guid" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           AND "rock_connection_block_guid" IS NULL)
         OR
         ("source_type"::text = 'connectionOpportunity'
           AND "rock_workflow_guid" IS NULL
           AND "rock_connection_block_guid" IS NOT NULL
           AND "rock_connection_block_guid" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
       )
  ) THEN
    RAISE EXCEPTION 'Migration produced invalid live form embed source rows';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "_pages_v_blocks_form_embed"
    WHERE "source_type" IS NULL
       OR NOT (
         ("source_type"::text = 'workflow'
           AND "rock_workflow_guid" IS NOT NULL
           AND "rock_workflow_guid" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           AND "rock_connection_block_guid" IS NULL)
         OR
         ("source_type"::text = 'connectionOpportunity'
           AND "rock_workflow_guid" IS NULL
           AND "rock_connection_block_guid" IS NOT NULL
           AND "rock_connection_block_guid" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
       )
  ) THEN
    RAISE EXCEPTION 'Migration produced invalid version form embed source rows';
  END IF;
END $$;

ALTER TABLE "pages_blocks_form_embed" ALTER COLUMN "source_type" SET NOT NULL;
ALTER TABLE "_pages_v_blocks_form_embed" ALTER COLUMN "source_type" SET NOT NULL;

ALTER TABLE "pages_blocks_form_embed"
  ADD CONSTRAINT "pages_blocks_form_embed_source_identity_check" CHECK (
    ("source_type"::text = 'workflow'
      AND "rock_workflow_guid" IS NOT NULL
      AND "rock_workflow_guid" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND "rock_connection_block_guid" IS NULL)
    OR
    ("source_type"::text = 'connectionOpportunity'
      AND "rock_workflow_guid" IS NULL
      AND "rock_connection_block_guid" IS NOT NULL
      AND "rock_connection_block_guid" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  );
ALTER TABLE "_pages_v_blocks_form_embed"
  ADD CONSTRAINT "_pages_v_blocks_form_embed_source_identity_check" CHECK (
    ("source_type"::text = 'workflow'
      AND "rock_workflow_guid" IS NOT NULL
      AND "rock_workflow_guid" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND "rock_connection_block_guid" IS NULL)
    OR
    ("source_type"::text = 'connectionOpportunity'
      AND "rock_workflow_guid" IS NULL
      AND "rock_connection_block_guid" IS NOT NULL
      AND "rock_connection_block_guid" ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  );

CREATE INDEX "pages_blocks_form_embed_connection_lookup_idx"
  ON "pages_blocks_form_embed" ("rock_connection_block_guid")
  WHERE "source_type" = 'connectionOpportunity';
CREATE INDEX "_pages_v_blocks_form_embed_connection_lookup_idx"
  ON "_pages_v_blocks_form_embed" ("rock_connection_block_guid")
  WHERE "source_type" = 'connectionOpportunity';

CREATE TABLE IF NOT EXISTS "rock_connection_signup_nonces" (
  "nonce_digest" varchar(64) PRIMARY KEY,
  "purpose" varchar(64) NOT NULL,
  "page_guid" varchar(36) NOT NULL,
  "block_guid" varchar(36) NOT NULL,
  "expires_at" timestamp(3) with time zone NOT NULL,
  "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "rock_connection_signup_nonces_digest_check" CHECK ("nonce_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "rock_connection_signup_nonces_purpose_check" CHECK ("purpose" = 'rock-connection-signup')
);
CREATE INDEX "rock_connection_signup_nonces_expires_idx"
  ON "rock_connection_signup_nonces" ("expires_at");

CREATE TABLE IF NOT EXISTS "rock_connection_signup_rate_limits" (
  "bucket_digest" varchar(64) NOT NULL,
  "route_class" varchar(16) NOT NULL,
  "window_started_at" timestamp(3) with time zone NOT NULL,
  "count" integer NOT NULL DEFAULT 1,
  "expires_at" timestamp(3) with time zone NOT NULL,
  "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("bucket_digest", "route_class", "window_started_at"),
  CONSTRAINT "rock_connection_signup_rate_digest_check" CHECK ("bucket_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "rock_connection_signup_rate_class_check" CHECK ("route_class" IN ('start', 'submit', 'personSearch')),
  CONSTRAINT "rock_connection_signup_rate_count_check" CHECK ("count" > 0)
);
CREATE INDEX "rock_connection_signup_rate_limits_expires_idx"
  ON "rock_connection_signup_rate_limits" ("expires_at");

CREATE OR REPLACE FUNCTION "rock_connection_signup_cleanup_expired"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM "rock_connection_signup_nonces"
  WHERE ctid IN (
    SELECT ctid FROM "rock_connection_signup_nonces"
    WHERE "expires_at" <= now()
    ORDER BY "expires_at"
    LIMIT 100
  );
  DELETE FROM "rock_connection_signup_rate_limits"
  WHERE ctid IN (
    SELECT ctid FROM "rock_connection_signup_rate_limits"
    WHERE "expires_at" <= now()
    ORDER BY "expires_at"
    LIMIT 100
  );
  RETURN NEW;
END $$;

CREATE TRIGGER "rock_connection_signup_nonces_cleanup_trigger"
  BEFORE INSERT ON "rock_connection_signup_nonces"
  FOR EACH STATEMENT EXECUTE FUNCTION "rock_connection_signup_cleanup_expired"();
CREATE TRIGGER "rock_connection_signup_rate_cleanup_trigger"
  BEFORE INSERT ON "rock_connection_signup_rate_limits"
  FOR EACH STATEMENT EXECUTE FUNCTION "rock_connection_signup_cleanup_expired"();
`

export const ROCK_CONNECTION_SIGNUP_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "pages_blocks_form_embed"
    WHERE "source_type"::text = 'connectionOpportunity'
       OR "rock_connection_block_guid" IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM "_pages_v_blocks_form_embed"
    WHERE "source_type"::text = 'connectionOpportunity'
       OR "rock_connection_block_guid" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot roll back Rock Connection Signup while live or version Connection rows exist';
  END IF;
END $$;

DROP TRIGGER IF EXISTS "rock_connection_signup_nonces_cleanup_trigger" ON "rock_connection_signup_nonces";
DROP TRIGGER IF EXISTS "rock_connection_signup_rate_cleanup_trigger" ON "rock_connection_signup_rate_limits";
DROP FUNCTION IF EXISTS "rock_connection_signup_cleanup_expired"();
DROP TABLE IF EXISTS "rock_connection_signup_rate_limits";
DROP TABLE IF EXISTS "rock_connection_signup_nonces";

DROP INDEX IF EXISTS "pages_blocks_form_embed_connection_lookup_idx";
DROP INDEX IF EXISTS "_pages_v_blocks_form_embed_connection_lookup_idx";
ALTER TABLE "pages_blocks_form_embed" DROP CONSTRAINT IF EXISTS "pages_blocks_form_embed_source_identity_check";
ALTER TABLE "_pages_v_blocks_form_embed" DROP CONSTRAINT IF EXISTS "_pages_v_blocks_form_embed_source_identity_check";
ALTER TABLE "pages_blocks_form_embed"
  DROP COLUMN IF EXISTS "rock_connection_block_guid",
  DROP COLUMN IF EXISTS "source_type";
ALTER TABLE "_pages_v_blocks_form_embed"
  DROP COLUMN IF EXISTS "rock_connection_block_guid",
  DROP COLUMN IF EXISTS "source_type";
DROP TYPE IF EXISTS "public"."enum_pages_blocks_form_embed_source_type";
DROP TYPE IF EXISTS "public"."enum__pages_v_blocks_form_embed_source_type";
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(ROCK_CONNECTION_SIGNUP_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(ROCK_CONNECTION_SIGNUP_DOWN_SQL))
}
