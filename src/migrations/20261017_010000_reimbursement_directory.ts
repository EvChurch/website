import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export const REIMBURSEMENT_DIRECTORY_UP_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS responsibility_centres (
  id serial PRIMARY KEY,
  rock_id numeric NOT NULL,
  rock_guid varchar NOT NULL,
  name varchar NOT NULL,
  sort_order numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT false,
  approver_person_alias_guid varchar,
  approver_rock_person_id numeric,
  approver_name varchar,
  approver_email varchar,
  last_synced_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS responsibility_centres_rock_id_idx ON responsibility_centres(rock_id);
CREATE UNIQUE INDEX IF NOT EXISTS responsibility_centres_rock_guid_idx ON responsibility_centres(rock_guid);
CREATE INDEX IF NOT EXISTS responsibility_centres_is_active_idx ON responsibility_centres(is_active);
CREATE INDEX IF NOT EXISTS responsibility_centres_approver_rock_person_id_idx ON responsibility_centres(approver_rock_person_id);
CREATE INDEX IF NOT EXISTS responsibility_centres_updated_at_idx ON responsibility_centres(updated_at);
CREATE INDEX IF NOT EXISTS responsibility_centres_created_at_idx ON responsibility_centres(created_at);

CREATE TABLE IF NOT EXISTS reimbursement_finance_members (
  id serial PRIMARY KEY,
  rock_membership_id numeric NOT NULL,
  rock_group_id numeric NOT NULL,
  rock_group_name varchar NOT NULL,
  rock_person_id numeric NOT NULL,
  name varchar NOT NULL,
  email varchar,
  last_synced_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS reimbursement_finance_members_rock_membership_id_idx ON reimbursement_finance_members(rock_membership_id);
CREATE INDEX IF NOT EXISTS reimbursement_finance_members_rock_group_id_idx ON reimbursement_finance_members(rock_group_id);
CREATE INDEX IF NOT EXISTS reimbursement_finance_members_rock_person_id_idx ON reimbursement_finance_members(rock_person_id);
CREATE INDEX IF NOT EXISTS reimbursement_finance_members_updated_at_idx ON reimbursement_finance_members(updated_at);
CREATE INDEX IF NOT EXISTS reimbursement_finance_members_created_at_idx ON reimbursement_finance_members(created_at);

ALTER TABLE payload_locked_documents_rels
  ADD COLUMN IF NOT EXISTS responsibility_centres_id integer REFERENCES responsibility_centres(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reimbursement_finance_members_id integer REFERENCES reimbursement_finance_members(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_responsibility_centres_id_idx ON payload_locked_documents_rels(responsibility_centres_id);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_reimb_finance_id_idx ON payload_locked_documents_rels(reimbursement_finance_members_id);
`

export const REIMBURSEMENT_DIRECTORY_DOWN_SQL = String.raw`
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE payload_locked_documents_rels
  DROP COLUMN IF EXISTS responsibility_centres_id,
  DROP COLUMN IF EXISTS reimbursement_finance_members_id;
DROP TABLE IF EXISTS reimbursement_finance_members;
DROP TABLE IF EXISTS responsibility_centres;
`

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql.raw(REIMBURSEMENT_DIRECTORY_UP_SQL))
}

export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql.raw(REIMBURSEMENT_DIRECTORY_DOWN_SQL))
}
