import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const FEEDBACK_TRIAGE_ASSESSMENT_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TYPE "public"."enum_feedback_submissions_resolution_status"
  ADD VALUE IF NOT EXISTS 'needs-approval';
ALTER TYPE "public"."enum_feedback_submissions_resolution_status"
  ADD VALUE IF NOT EXISTS 'duplicate';

DO $$ BEGIN
  CREATE TYPE "public"."enum_feedback_submissions_classification" AS ENUM(
    'bug', 'content-change', 'feature-request', 'unclear', 'duplicate', 'spam', 'appreciation'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "public"."enum_feedback_submissions_risk" AS ENUM('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "public"."enum_feedback_submissions_requester_rank" AS ENUM(
    'high', 'standard', 'low', 'unmatched'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "public"."enum_feedback_submissions_area_relevance" AS ENUM(
    'own-area', 'adjacent-area', 'outside-area', 'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "public"."enum_feedback_submissions_priority" AS ENUM(
    'urgent', 'high', 'normal', 'low'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "public"."enum_feedback_submissions_recommendation" AS ENUM(
    'work-on-it', 'wont-fix', 'needs-more-information'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "public"."enum_feedback_submissions_requester_team_group_snapshot" AS ENUM(
    'staff', 'leadership', 'apprentices'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "public"."enum_feedback_submissions_delivery_kind" AS ENUM('content', 'code');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "public"."enum_feedback_submissions_delivery_phase" AS ENUM(
    'content-update', 'branch-created', 'pr-open', 'ci-passed', 'merged',
    'deployment-started', 'deployed', 'verified', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "public"."enum_feedback_submissions_delivery_verification_result" AS ENUM(
    'pending', 'passed', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "feedback_submissions"
  ADD COLUMN IF NOT EXISTS "triage_summary" varchar,
  ADD COLUMN IF NOT EXISTS "classification" "enum_feedback_submissions_classification",
  ADD COLUMN IF NOT EXISTS "risk" "enum_feedback_submissions_risk",
  ADD COLUMN IF NOT EXISTS "requester_rank" "enum_feedback_submissions_requester_rank",
  ADD COLUMN IF NOT EXISTS "area_relevance" "enum_feedback_submissions_area_relevance",
  ADD COLUMN IF NOT EXISTS "priority" "enum_feedback_submissions_priority",
  ADD COLUMN IF NOT EXISTS "recommendation" "enum_feedback_submissions_recommendation",
  ADD COLUMN IF NOT EXISTS "recommendation_rationale" varchar,
  ADD COLUMN IF NOT EXISTS "requester_team_member_id" integer,
  ADD COLUMN IF NOT EXISTS "requester_name_snapshot" varchar,
  ADD COLUMN IF NOT EXISTS "requester_role_snapshot" varchar,
  ADD COLUMN IF NOT EXISTS "requester_team_group_snapshot" "enum_feedback_submissions_requester_team_group_snapshot",
  ADD COLUMN IF NOT EXISTS "duplicate_of_id" integer,
  ADD COLUMN IF NOT EXISTS "triaged_at" timestamp(3) with time zone,
  ADD COLUMN IF NOT EXISTS "triage_run_id" varchar,
  ADD COLUMN IF NOT EXISTS "triage_version" varchar,
  ADD COLUMN IF NOT EXISTS "delivery_kind" "enum_feedback_submissions_delivery_kind",
  ADD COLUMN IF NOT EXISTS "delivery_phase" "enum_feedback_submissions_delivery_phase",
  ADD COLUMN IF NOT EXISTS "delivery_run_id" varchar,
  ADD COLUMN IF NOT EXISTS "delivery_branch" varchar,
  ADD COLUMN IF NOT EXISTS "delivery_pr_url" varchar,
  ADD COLUMN IF NOT EXISTS "delivery_merge_commit" varchar,
  ADD COLUMN IF NOT EXISTS "delivery_deployment_id" varchar,
  ADD COLUMN IF NOT EXISTS "delivery_verification_result" "enum_feedback_submissions_delivery_verification_result",
  ADD COLUMN IF NOT EXISTS "delivery_last_verified_at" timestamp(3) with time zone,
  ADD COLUMN IF NOT EXISTS "delivery_failure_note" varchar;

DO $$ BEGIN
  ALTER TABLE "feedback_submissions"
    ADD CONSTRAINT "feedback_submissions_requester_team_member_id_team_members_id_fk"
    FOREIGN KEY ("requester_team_member_id") REFERENCES "public"."team_members"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "feedback_submissions"
    ADD CONSTRAINT "feedback_submissions_duplicate_of_id_feedback_submissions_id_fk"
    FOREIGN KEY ("duplicate_of_id") REFERENCES "public"."feedback_submissions"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION prevent_canonical_feedback_deletion()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "feedback_submissions" WHERE "duplicate_of_id" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'Cannot delete canonical feedback while duplicates reference it';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "feedback_submissions_prevent_canonical_delete" ON "feedback_submissions";
CREATE TRIGGER "feedback_submissions_prevent_canonical_delete"
  BEFORE DELETE ON "feedback_submissions"
  FOR EACH ROW EXECUTE FUNCTION prevent_canonical_feedback_deletion();

CREATE INDEX IF NOT EXISTS "feedback_submissions_classification_idx"
  ON "feedback_submissions" USING btree ("classification");
CREATE INDEX IF NOT EXISTS "feedback_submissions_priority_idx"
  ON "feedback_submissions" USING btree ("priority");
CREATE INDEX IF NOT EXISTS "feedback_submissions_requester_team_member_idx"
  ON "feedback_submissions" USING btree ("requester_team_member_id");
CREATE INDEX IF NOT EXISTS "feedback_submissions_duplicate_of_idx"
  ON "feedback_submissions" USING btree ("duplicate_of_id");
CREATE INDEX IF NOT EXISTS "feedback_submissions_triaged_at_idx"
  ON "feedback_submissions" USING btree ("triaged_at");
CREATE INDEX IF NOT EXISTS "feedback_submissions_delivery_phase_idx"
  ON "feedback_submissions" USING btree ("delivery_phase");
`

export const FEEDBACK_TRIAGE_ASSESSMENT_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

UPDATE "feedback_submissions"
SET "resolution_status" = CASE
  WHEN "resolution_status" = 'needs-approval' THEN 'new'
  ELSE 'resolved'
END::"enum_feedback_submissions_resolution_status"
WHERE "resolution_status" IN ('needs-approval', 'duplicate');

DROP INDEX IF EXISTS "feedback_submissions_delivery_phase_idx";
DROP INDEX IF EXISTS "feedback_submissions_triaged_at_idx";
DROP INDEX IF EXISTS "feedback_submissions_duplicate_of_idx";
DROP INDEX IF EXISTS "feedback_submissions_requester_team_member_idx";
DROP INDEX IF EXISTS "feedback_submissions_priority_idx";
DROP INDEX IF EXISTS "feedback_submissions_classification_idx";

DROP TRIGGER IF EXISTS "feedback_submissions_prevent_canonical_delete" ON "feedback_submissions";
DROP FUNCTION IF EXISTS prevent_canonical_feedback_deletion();

ALTER TABLE "feedback_submissions"
  DROP CONSTRAINT IF EXISTS "feedback_submissions_duplicate_of_id_feedback_submissions_id_fk",
  DROP CONSTRAINT IF EXISTS "feedback_submissions_requester_team_member_id_team_members_id_fk",
  DROP COLUMN IF EXISTS "delivery_failure_note",
  DROP COLUMN IF EXISTS "delivery_last_verified_at",
  DROP COLUMN IF EXISTS "delivery_verification_result",
  DROP COLUMN IF EXISTS "delivery_deployment_id",
  DROP COLUMN IF EXISTS "delivery_merge_commit",
  DROP COLUMN IF EXISTS "delivery_pr_url",
  DROP COLUMN IF EXISTS "delivery_branch",
  DROP COLUMN IF EXISTS "delivery_run_id",
  DROP COLUMN IF EXISTS "delivery_phase",
  DROP COLUMN IF EXISTS "delivery_kind",
  DROP COLUMN IF EXISTS "triage_version",
  DROP COLUMN IF EXISTS "triage_run_id",
  DROP COLUMN IF EXISTS "triaged_at",
  DROP COLUMN IF EXISTS "duplicate_of_id",
  DROP COLUMN IF EXISTS "requester_team_group_snapshot",
  DROP COLUMN IF EXISTS "requester_role_snapshot",
  DROP COLUMN IF EXISTS "requester_name_snapshot",
  DROP COLUMN IF EXISTS "requester_team_member_id",
  DROP COLUMN IF EXISTS "recommendation_rationale",
  DROP COLUMN IF EXISTS "recommendation",
  DROP COLUMN IF EXISTS "priority",
  DROP COLUMN IF EXISTS "area_relevance",
  DROP COLUMN IF EXISTS "requester_rank",
  DROP COLUMN IF EXISTS "risk",
  DROP COLUMN IF EXISTS "classification",
  DROP COLUMN IF EXISTS "triage_summary";

ALTER TABLE "feedback_submissions" ALTER COLUMN "resolution_status" DROP DEFAULT;
ALTER TYPE "public"."enum_feedback_submissions_resolution_status"
  RENAME TO "enum_feedback_submissions_resolution_status_old";
CREATE TYPE "public"."enum_feedback_submissions_resolution_status" AS ENUM(
  'new', 'planned', 'in-progress', 'resolved', 'wont-fix'
);
ALTER TABLE "feedback_submissions" ALTER COLUMN "resolution_status"
  TYPE "public"."enum_feedback_submissions_resolution_status"
  USING "resolution_status"::text::"public"."enum_feedback_submissions_resolution_status";
ALTER TABLE "feedback_submissions" ALTER COLUMN "resolution_status" SET DEFAULT 'new';
DROP TYPE "public"."enum_feedback_submissions_resolution_status_old";

DROP TYPE IF EXISTS "public"."enum_feedback_submissions_delivery_verification_result";
DROP TYPE IF EXISTS "public"."enum_feedback_submissions_delivery_phase";
DROP TYPE IF EXISTS "public"."enum_feedback_submissions_delivery_kind";
DROP TYPE IF EXISTS "public"."enum_feedback_submissions_requester_team_group_snapshot";
DROP TYPE IF EXISTS "public"."enum_feedback_submissions_recommendation";
DROP TYPE IF EXISTS "public"."enum_feedback_submissions_priority";
DROP TYPE IF EXISTS "public"."enum_feedback_submissions_area_relevance";
DROP TYPE IF EXISTS "public"."enum_feedback_submissions_requester_rank";
DROP TYPE IF EXISTS "public"."enum_feedback_submissions_risk";
DROP TYPE IF EXISTS "public"."enum_feedback_submissions_classification";
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(FEEDBACK_TRIAGE_ASSESSMENT_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(FEEDBACK_TRIAGE_ASSESSMENT_DOWN_SQL))
}
