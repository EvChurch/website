import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export const GIVING_FINANCIAL_CONTROLS_UP_SQL = String.raw`
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';
ALTER TABLE giving_gifts ADD COLUMN refunded_minor numeric,
  ADD COLUMN refund_pending_minor numeric, ADD COLUMN refunds_verified_at timestamptz,
  ADD COLUMN refunds_last_attempt_at timestamptz,
  ADD CONSTRAINT giving_gift_refunds_valid CHECK(
    (refunded_minor IS NULL OR (refunded_minor>=0 AND refunded_minor<=amount_minor+transaction_fee_minor AND refunded_minor=trunc(refunded_minor))) AND
    (refund_pending_minor IS NULL OR (refund_pending_minor>=0 AND refund_pending_minor<=amount_minor+transaction_fee_minor AND refund_pending_minor=trunc(refund_pending_minor))));
CREATE TABLE giving_stripe_refunds (
  environment varchar NOT NULL CHECK(environment IN ('sandbox','production')),
  refund_id varchar NOT NULL, gift_id integer NOT NULL REFERENCES giving_gifts(id), charge_id varchar NOT NULL,
  amount_minor numeric NOT NULL CHECK(amount_minor>0 AND amount_minor=trunc(amount_minor)),
  status varchar NOT NULL CHECK(status IN ('pending','requires_action','succeeded','failed','canceled')),
  balance_transaction_id varchar, provider_created_at timestamptz NOT NULL, verified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(environment,refund_id)
);
CREATE INDEX giving_stripe_refunds_gift ON giving_stripe_refunds(gift_id);
ALTER TABLE giving_stripe_card_updates DROP CONSTRAINT giving_stripe_card_updates_pkey,
  ADD COLUMN version bigserial PRIMARY KEY, ADD COLUMN applied_at timestamptz,
  ALTER COLUMN session_id DROP NOT NULL, ADD CONSTRAINT giving_stripe_card_update_session_unique UNIQUE(session_id);
CREATE INDEX giving_stripe_card_update_version ON giving_stripe_card_updates(schedule_id,version DESC);
-- Old requests have no reliable creation order. Keep their audit rows, but require a new link.
ALTER TABLE giving_stripe_card_updates ADD COLUMN superseded boolean NOT NULL DEFAULT false;
UPDATE giving_stripe_card_updates SET superseded=true;
`

export async function up({ db }: MigrateUpArgs) { await db.execute(sql.raw(GIVING_FINANCIAL_CONTROLS_UP_SQL)) }
export async function down(_args: MigrateDownArgs) { throw new Error('Financial control history requires a forward migration') }
