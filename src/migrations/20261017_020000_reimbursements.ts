import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export const REIMBURSEMENTS_UP_SQL = String.raw`
ALTER TYPE enum_payload_jobs_task_slug ADD VALUE IF NOT EXISTS 'reconcileReimbursementEmails';
ALTER TYPE enum_payload_jobs_log_task_slug ADD VALUE IF NOT EXISTS 'reconcileReimbursementEmails';
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE IF NOT EXISTS reimbursement_profiles (
 person_id integer PRIMARY KEY, opened_at timestamptz NOT NULL DEFAULT now(), account_name text NOT NULL DEFAULT '', account_number text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS reimbursement_categories (
 id serial PRIMARY KEY, name text NOT NULL UNIQUE, archived boolean NOT NULL DEFAULT false
);
INSERT INTO reimbursement_categories(name) VALUES
 ('Food & hospitality'),('Ministry supplies & resources'),('Events & activities'),
 ('Printing & advertising'),('Training & conferences'),('Equipment & decorations'),
 ('Software & subscriptions'),('Phone & internet'),('Travel & transport'),
 ('Cleaning & maintenance'),('Venue hire'),('Other / unsure') ON CONFLICT(name) DO NOTHING;
CREATE TABLE IF NOT EXISTS reimbursement_settings (
 id integer PRIMARY KEY CHECK(id=1), data jsonb NOT NULL DEFAULT '{"seniorPersonId":null,"seniorName":"","seniorEmail":"","alternatePersonId":null,"alternateName":"","alternateEmail":"","financeEmail":""}'
);
INSERT INTO reimbursement_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS reimbursement_receipts (
 hash text PRIMARY KEY CHECK(hash ~ '^[a-f0-9]{64}$'), media_type text NOT NULL,
 body bytea NOT NULL CHECK(octet_length(body)>0 AND octet_length(body)<=10485760), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reimbursement_receipt_owners (
 hash text REFERENCES reimbursement_receipts(hash) ON DELETE CASCADE, person_id integer NOT NULL,
 filename text NOT NULL, PRIMARY KEY(hash,person_id)
);
CREATE TABLE IF NOT EXISTS reimbursement_reports (
 id uuid PRIMARY KEY, number serial UNIQUE NOT NULL, claimant_id integer NOT NULL, claimant_name text NOT NULL, claimant_email text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','rc-approval','finance-approval','awaiting-payment','rejected','paid','cancelled')),
 version integer NOT NULL DEFAULT 1, revision integer NOT NULL DEFAULT 0,
 centre_id integer REFERENCES responsibility_centres(id), centre_name text NOT NULL DEFAULT '',
 account_name text NOT NULL DEFAULT '', account_number text NOT NULL DEFAULT '', lines jsonb NOT NULL DEFAULT '[]', history jsonb NOT NULL DEFAULT '[]',
 rc_approver_id integer,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reimbursement_reports_claimant_idx ON reimbursement_reports(claimant_id);
CREATE INDEX IF NOT EXISTS reimbursement_reports_centre_idx ON reimbursement_reports(centre_id);
CREATE INDEX IF NOT EXISTS reimbursement_reports_status_idx ON reimbursement_reports(status);
CREATE TABLE IF NOT EXISTS reimbursement_email_deliveries (
 id uuid PRIMARY KEY, report_id uuid NOT NULL REFERENCES reimbursement_reports(id), version integer NOT NULL, revision integer NOT NULL,
 kind text NOT NULL, recipient text NOT NULL, subject text NOT NULL, body text NOT NULL,
 include_payment boolean NOT NULL DEFAULT false, include_pdf boolean NOT NULL DEFAULT false,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','sent','failed','cancelled')),
 attempts integer NOT NULL DEFAULT 0, payload jsonb, first_attempt_at timestamptz, provider_id text, lease_until timestamptz, lease_token uuid,
 created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz,
 UNIQUE(report_id,revision,kind,recipient)
);
CREATE INDEX IF NOT EXISTS reimbursement_email_deliveries_state_idx ON reimbursement_email_deliveries(state);
`
export async function up({ db }: MigrateUpArgs) { await db.execute(sql.raw(REIMBURSEMENTS_UP_SQL)) }
export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql`DO $$ BEGIN RAISE EXCEPTION 'Reimbursements contain financial history. Use a reviewed data-preserving rollback.'; END $$;`)
}
