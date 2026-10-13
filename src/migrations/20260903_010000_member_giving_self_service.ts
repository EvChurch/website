import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

export const MEMBER_GIVING_SELF_SERVICE_UP_SQL = String.raw`
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';

ALTER TABLE giving_provider_operations
  ADD COLUMN IF NOT EXISTS member_actor_rock_person_id numeric,
  ADD COLUMN IF NOT EXISTS member_actor_rock_person_alias_id numeric,
  ADD COLUMN IF NOT EXISTS member_actor_auth0_subject varchar;

ALTER TABLE giving_provider_operations DROP CONSTRAINT IF EXISTS giving_provider_cancel_audit_valid;
ALTER TABLE giving_provider_operations ADD CONSTRAINT giving_provider_cancel_audit_valid CHECK(
  action <> 'blinkpay.cancel-schedule'
  OR (
    schedule_id IS NOT NULL
    AND char_length(reason) BETWEEN 3 AND 500
    AND (
      actor_id IS NOT NULL
      OR (
        member_actor_rock_person_id IS NOT NULL
        AND member_actor_rock_person_alias_id IS NOT NULL
        AND char_length(member_actor_auth0_subject) BETWEEN 1 AND 249
      )
    )
  )
);
CREATE INDEX IF NOT EXISTS giving_provider_operations_member_actor_alias_idx
  ON giving_provider_operations(member_actor_rock_person_alias_id)
  WHERE member_actor_rock_person_alias_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS giving_cancellation_feedback (
  id serial PRIMARY KEY,
  context_key varchar NOT NULL,
  environment varchar NOT NULL,
  synthetic boolean NOT NULL,
  schedule_id integer NOT NULL,
  giver_id integer NOT NULL,
  operation_id integer NOT NULL UNIQUE REFERENCES giving_provider_operations(id) ON DELETE RESTRICT,
  member_rock_person_id numeric NOT NULL,
  member_rock_person_alias_id numeric NOT NULL,
  member_auth0_subject varchar NOT NULL,
  reason varchar NOT NULL CHECK(reason IN ('changing_details','circumstances_changed','mistake','prefer_not_to_say','other')),
  note varchar,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT giving_cancellation_feedback_subject_valid CHECK(char_length(member_auth0_subject) BETWEEN 1 AND 249),
  CONSTRAINT giving_cancellation_feedback_other_note_valid CHECK(reason <> 'other' OR (note IS NOT NULL AND char_length(note) BETWEEN 1 AND 500)),
  CONSTRAINT giving_cancellation_feedback_provenance_valid CHECK((environment='production' AND NOT synthetic AND context_key='production') OR (environment='sandbox' AND synthetic AND context_key='sandbox')),
  FOREIGN KEY(schedule_id,context_key) REFERENCES giving_schedules(id,context_key) ON DELETE RESTRICT,
  FOREIGN KEY(giver_id,context_key) REFERENCES giving_givers(id,context_key) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS giving_cancellation_feedback_schedule_idx ON giving_cancellation_feedback(schedule_id);
CREATE INDEX IF NOT EXISTS giving_cancellation_feedback_giver_idx ON giving_cancellation_feedback(giver_id);
CREATE INDEX IF NOT EXISTS giving_cancellation_feedback_reason_idx ON giving_cancellation_feedback(reason);

ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS "giving_cancellation_feedback_id" integer;
DO $$ BEGIN ALTER TABLE payload_locked_documents_rels ADD CONSTRAINT payload_locked_documents_rels_giving_cancellation_feedback_fk FOREIGN KEY ("giving_cancellation_feedback_id") REFERENCES "giving_cancellation_feedback"(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_giving_cancellation_feedback_id_idx ON payload_locked_documents_rels("giving_cancellation_feedback_id");
`

export const MEMBER_GIVING_SELF_SERVICE_DOWN_SQL = String.raw`
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM giving_cancellation_feedback LIMIT 1)
    OR EXISTS(SELECT 1 FROM giving_provider_operations WHERE member_actor_auth0_subject IS NOT NULL LIMIT 1) THEN
    RAISE EXCEPTION 'Cannot roll back member giving self service after member cancellation data exists';
  END IF;
END $$;
DROP INDEX IF EXISTS payload_locked_documents_rels_giving_cancellation_feedback_id_idx;
ALTER TABLE payload_locked_documents_rels DROP CONSTRAINT IF EXISTS payload_locked_documents_rels_giving_cancellation_feedback_fk;
ALTER TABLE payload_locked_documents_rels DROP COLUMN IF EXISTS "giving_cancellation_feedback_id";
DROP TABLE IF EXISTS giving_cancellation_feedback;
DROP INDEX IF EXISTS giving_provider_operations_member_actor_alias_idx;
ALTER TABLE giving_provider_operations DROP CONSTRAINT IF EXISTS giving_provider_cancel_audit_valid;
ALTER TABLE giving_provider_operations ADD CONSTRAINT giving_provider_cancel_audit_valid CHECK(
  action <> 'blinkpay.cancel-schedule' OR (schedule_id IS NOT NULL AND actor_id IS NOT NULL AND char_length(reason) BETWEEN 3 AND 500)
);
ALTER TABLE giving_provider_operations
  DROP COLUMN IF EXISTS member_actor_auth0_subject,
  DROP COLUMN IF EXISTS member_actor_rock_person_alias_id,
  DROP COLUMN IF EXISTS member_actor_rock_person_id;
`

export async function up({ db }: MigrateUpArgs) { await db.execute(sql.raw(MEMBER_GIVING_SELF_SERVICE_UP_SQL)) }
export async function down({ db }: MigrateDownArgs) { await db.execute(sql.raw(MEMBER_GIVING_SELF_SERVICE_DOWN_SQL)) }
