import { sql, type MigrateUpArgs } from '@payloadcms/db-postgres'

export const FEEDBACK_COMMUNICATIONS_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE IF NOT EXISTS feedback_communications (
  id uuid PRIMARY KEY,
  message jsonb NOT NULL,
  items jsonb NOT NULL,
  status varchar NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  first_attempt_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  provider_id varchar,
  sent_at timestamptz,
  error varchar
);
CREATE INDEX IF NOT EXISTS feedback_communications_pending_idx ON feedback_communications(status, next_attempt_at);
CREATE TABLE IF NOT EXISTS feedback_communication_events (
  feedback_id integer NOT NULL REFERENCES feedback_submissions(id) ON DELETE RESTRICT,
  stage varchar NOT NULL CHECK (stage IN ('triaged', 'outcome')),
  communication_id uuid NOT NULL REFERENCES feedback_communications(id) ON DELETE RESTRICT,
  PRIMARY KEY (feedback_id, stage)
);
ALTER TABLE payload_mcp_api_keys
  ADD COLUMN IF NOT EXISTS "payload_mcp_tool_send_feedback_update" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "payload_mcp_tool_find_feedback_updates" boolean DEFAULT false;
UPDATE payload_mcp_api_keys SET
  payload_mcp_tool_send_feedback_update = true,
  payload_mcp_tool_find_feedback_updates = true
WHERE feedback_submissions_find = true AND feedback_submissions_update = true;
ALTER TYPE enum_payload_jobs_task_slug ADD VALUE IF NOT EXISTS 'reconcileFeedbackCommunications';
ALTER TYPE enum_payload_jobs_log_task_slug ADD VALUE IF NOT EXISTS 'reconcileFeedbackCommunications';
`

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql.raw(FEEDBACK_COMMUNICATIONS_SQL))
}

export async function down() {
  // Retain email history and idempotency records across code rollbacks.
}
