import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export const STRIPE_GIVING_UP_SQL = String.raw`
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';
ALTER TABLE giving_settings ADD COLUMN card_fixed_minor numeric NOT NULL DEFAULT 30,
  ADD COLUMN card_percentage_basis_points numeric NOT NULL DEFAULT 250,
  ADD CONSTRAINT giving_card_fee_valid CHECK(card_fixed_minor BETWEEN 0 AND 10000 AND card_fixed_minor=trunc(card_fixed_minor) AND card_percentage_basis_points BETWEEN 0 AND 2000 AND card_percentage_basis_points=trunc(card_percentage_basis_points));
ALTER TABLE giving_checkouts ADD COLUMN payment_provider varchar NOT NULL DEFAULT 'blinkpay' CHECK(payment_provider IN ('blinkpay','stripe','manual'));
ALTER TABLE giving_schedules ADD COLUMN payment_provider varchar NOT NULL DEFAULT 'blinkpay' CHECK(payment_provider IN ('blinkpay','stripe')),
  ALTER COLUMN consent_id DROP NOT NULL,
  ADD CONSTRAINT giving_schedule_consent_provider CHECK((payment_provider='blinkpay' AND consent_id IS NOT NULL) OR (payment_provider='stripe' AND consent_id IS NULL));
ALTER TABLE giving_gifts ADD COLUMN payment_provider varchar NOT NULL DEFAULT 'blinkpay' CHECK(payment_provider IN ('blinkpay','stripe')),
  ADD COLUMN provider_charge_id varchar, ADD COLUMN provider_invoice_id varchar, ADD COLUMN processing_fee_minor numeric, ADD COLUMN net_minor numeric,
  ADD COLUMN payout_id varchar, ADD COLUMN payout_status varchar, ADD COLUMN dispute_status varchar;
ALTER TABLE giving_gifts DROP CONSTRAINT giving_gifts_payment_unique;
ALTER TABLE giving_gifts ADD CONSTRAINT giving_gifts_payment_unique UNIQUE(environment,payment_provider,provider_payment_id);
ALTER TABLE giving_schedules DROP CONSTRAINT giving_schedules_environment_provider_schedule_id_key;
ALTER TABLE giving_schedules ADD CONSTRAINT giving_schedule_provider_unique UNIQUE(environment,payment_provider,provider_schedule_id);
CREATE OR REPLACE FUNCTION giving_provider_requires_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.provider IN ('blinkpay','stripe') AND NOT EXISTS(SELECT 1 FROM giving_checkouts WHERE id=NEW.checkout_id AND context_key=NEW.context_key AND giver_id IS NOT NULL) THEN RAISE EXCEPTION 'Payment operations require a bound giver'; END IF; RETURN NEW; END $$;
ALTER TABLE giving_checkouts DROP CONSTRAINT giving_checkouts_transaction_fee_minor_nonnegative_integer;
ALTER TABLE giving_checkouts ADD CONSTRAINT giving_checkouts_transaction_fee_minor_nonnegative_integer CHECK(transaction_fee_minor>=0 AND transaction_fee_minor<=99999999 AND transaction_fee_minor=trunc(transaction_fee_minor));
ALTER TABLE giving_gifts DROP CONSTRAINT giving_gifts_transaction_fee_minor_nonnegative_integer;
ALTER TABLE giving_gifts ADD CONSTRAINT giving_gifts_transaction_fee_minor_nonnegative_integer CHECK(transaction_fee_minor>=0 AND transaction_fee_minor<=99999999 AND transaction_fee_minor=trunc(transaction_fee_minor));
ALTER TABLE giving_schedules DROP CONSTRAINT giving_schedules_transaction_fee_minor_nonnegative_integer;
ALTER TABLE giving_schedules ADD CONSTRAINT giving_schedules_transaction_fee_minor_nonnegative_integer CHECK(transaction_fee_minor>=0 AND transaction_fee_minor<=99999999 AND transaction_fee_minor=trunc(transaction_fee_minor));
ALTER TABLE giving_provider_operations ADD CONSTRAINT giving_stripe_cancel_audit CHECK(action<>'stripe.cancel-schedule' OR (schedule_id IS NOT NULL AND char_length(reason) BETWEEN 3 AND 500 AND (actor_id IS NOT NULL OR (member_actor_rock_person_id IS NOT NULL AND member_actor_rock_person_alias_id IS NOT NULL AND char_length(member_actor_auth0_subject) BETWEEN 1 AND 249))));
CREATE TABLE giving_stripe_sessions (
  checkout_id integer PRIMARY KEY REFERENCES giving_checkouts(id), first_payment_immediate boolean NOT NULL DEFAULT false,
  session_id varchar UNIQUE, client_secret varchar, customer_id varchar, subscription_id varchar UNIQUE,
  creation_started_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz, last_attempt_at timestamptz, last_error varchar
);
CREATE TABLE giving_stripe_card_updates(session_id varchar PRIMARY KEY,schedule_id integer NOT NULL REFERENCES giving_schedules(id),customer_id varchar NOT NULL,environment varchar NOT NULL);
CREATE TABLE giving_stripe_schedule_attempts(checkout_id integer PRIMARY KEY REFERENCES giving_checkouts(id),started_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE giving_stripe_balances(environment varchar NOT NULL,charge_id varchar NOT NULL,payout_id varchar NOT NULL,fee_minor numeric NOT NULL,net_minor numeric NOT NULL,payout_status varchar NOT NULL DEFAULT 'paid',PRIMARY KEY(environment,charge_id));
CREATE TABLE giving_stripe_events (
  id bigserial PRIMARY KEY, environment varchar NOT NULL CHECK(environment IN ('sandbox','production')),
  event_id varchar NOT NULL, event_type varchar NOT NULL, payload_digest varchar NOT NULL, payload jsonb NOT NULL,
  status varchar NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processed','quarantined')),
  attempts integer NOT NULL DEFAULT 0, last_attempt_at timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error varchar, created_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz,
  UNIQUE(environment,event_id)
);
CREATE INDEX giving_stripe_events_pending ON giving_stripe_events(id) WHERE status='pending';
CREATE INDEX giving_stripe_sessions_customer ON giving_stripe_sessions(customer_id);
ALTER TABLE giving_email_deliveries DROP CONSTRAINT giving_email_deliveries_status_check;
ALTER TABLE giving_email_deliveries ADD CONSTRAINT giving_email_deliveries_status_check CHECK(status IN ('pending','sending','sent','failed','skipped'));
ALTER TABLE giving_email_deliveries DROP CONSTRAINT giving_email_deliveries_kind_check;
ALTER TABLE giving_email_deliveries ADD CONSTRAINT giving_email_deliveries_kind_check CHECK(kind IN ('bank-transfer-details','bank-transfer-thanks','blinkpay-thanks','blinkpay-support','stripe-thanks','stripe-support','stripe-failed','stripe-action','stripe-stopped'));
ALTER TABLE giving_email_deliveries ADD COLUMN event_key varchar NOT NULL DEFAULT '', ADD COLUMN action_url varchar;
ALTER TABLE giving_email_deliveries DROP CONSTRAINT giving_email_deliveries_checkout_id_kind_key;
ALTER TABLE giving_email_deliveries ADD CONSTRAINT giving_email_delivery_event_unique UNIQUE(checkout_id,kind,event_key);
CREATE UNIQUE INDEX giving_email_deliveries_completion_unique ON giving_email_deliveries(checkout_id,kind) WHERE event_key='';
DO $$ BEGIN
  ALTER TYPE "public"."enum_payload_jobs_log_task_slug" ADD VALUE IF NOT EXISTS 'reconcileStripeGiving';
  ALTER TYPE "public"."enum_payload_jobs_task_slug" ADD VALUE IF NOT EXISTS 'reconcileStripeGiving';
EXCEPTION WHEN undefined_object THEN NULL; END $$;
`
export async function up({ db }: MigrateUpArgs) { await db.execute(sql.raw(STRIPE_GIVING_UP_SQL)) }
export async function down(_args: MigrateDownArgs) { throw new Error('Stripe financial history requires a forward migration; automatic rollback is disabled') }
