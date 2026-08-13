import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

const MCP_COLLECTION_TABLE_NAMES = [
  'users', 'media', 'blog_posts', 'announcements', 'campuses', 'team_members',
  'events', 'connect_groups', 'connect_group_participants',
  'connect_group_leader_resources', 'daily_bible_readings', 'missing_paths',
  'feedback_submissions', 'registrations', 'service_guide_items', 'sermon_series',
  'sermons', 'speakers', 'topics', 'categories', 'scriptures', 'sermon_audio',
] as const
const MCP_COLLECTION_OPERATIONS = ['find', 'create', 'update', 'delete'] as const
const MCP_GLOBAL_TABLE_NAMES = [
  'navigation', 'site_settings', 'service_guide_sync_state',
] as const
const MCP_GLOBAL_OPERATIONS = ['find', 'update'] as const

export const MCP_PERMISSION_FIELDS = [
  ...MCP_COLLECTION_TABLE_NAMES.flatMap((name) =>
    MCP_COLLECTION_OPERATIONS.map((operation) => `${name}_${operation}`),
  ),
  ...MCP_GLOBAL_TABLE_NAMES.flatMap((name) =>
    MCP_GLOBAL_OPERATIONS.map((operation) => `${name}_${operation}`),
  ),
]

const addMcpPermissions = `ALTER TABLE "payload_mcp_api_keys"\n${MCP_PERMISSION_FIELDS.map(
  (field) => `  ADD COLUMN IF NOT EXISTS "${field}" boolean DEFAULT false`,
).join(',\n')};`

const dropMcpPermissions = [...MCP_PERMISSION_FIELDS]
  .reverse()
  .map((field) => `  DROP COLUMN IF EXISTS "${field}"`)
  .join(',\n')

const dropMcpPermissionColumns = `ALTER TABLE "payload_mcp_api_keys"\n${dropMcpPermissions};`

export const FEEDBACK_TRIAGE_ALL_MCP_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'enum_feedback_submissions_resolution_status'
  ) THEN
    CREATE TYPE "public"."enum_feedback_submissions_resolution_status" AS ENUM(
      'new', 'planned', 'in-progress', 'resolved', 'wont-fix'
    );
  END IF;
END $$;

ALTER TABLE "feedback_submissions"
  ADD COLUMN IF NOT EXISTS "resolution_status"
  "enum_feedback_submissions_resolution_status" NOT NULL DEFAULT 'new';

UPDATE "feedback_submissions"
SET "email" = CONCAT('feedback-', "id", '@legacy.invalid')
WHERE "email" IS NULL OR BTRIM("email") = '';

ALTER TABLE "feedback_submissions" ALTER COLUMN "email" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "feedback_submissions_resolution_status_idx"
  ON "feedback_submissions" USING btree ("resolution_status");

${addMcpPermissions}

UPDATE "payload_mcp_api_keys"
SET "feedback_submissions_find" = true,
    "feedback_submissions_update" = true
WHERE "enable_a_p_i_key" = true;
`

export const FEEDBACK_TRIAGE_ALL_MCP_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

${dropMcpPermissionColumns}

DROP INDEX IF EXISTS "feedback_submissions_resolution_status_idx";
ALTER TABLE "feedback_submissions" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "feedback_submissions" DROP COLUMN IF EXISTS "resolution_status";
DROP TYPE IF EXISTS "public"."enum_feedback_submissions_resolution_status";
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(FEEDBACK_TRIAGE_ALL_MCP_UP_SQL))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(FEEDBACK_TRIAGE_ALL_MCP_DOWN_SQL))
}
