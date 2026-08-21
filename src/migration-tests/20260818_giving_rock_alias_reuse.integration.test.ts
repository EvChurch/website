import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { GIVING_PILOT_UP_SQL } from '../migrations/20260815_170000_giving_pilot'
import { GIVING_CHECKOUT_ORCHESTRATION_UP_SQL } from '../migrations/20260815_230000_giving_checkout_orchestration'
import { GIVING_BANK_CODE_UP_SQL } from '../migrations/20260817_010000_giving_bank_code'
import { GIVING_BANK_ACKNOWLEDGEMENT_UP_SQL } from '../migrations/20260817_020000_giving_bank_acknowledgement'
import { GIVING_ROCK_ALIAS_REUSE_UP_SQL } from '../migrations/20260818_010000_giving_rock_alias_reuse'
import { GIVING_EMAIL_DELIVERIES_UP_SQL } from '../migrations/20260822_010000_giving_email_deliveries'
import { createPostgresGivingCheckoutRepository } from '../lib/giving/service'

const databaseUrl = process.env.GIVING_MIGRATION_TEST_DATABASE_URL

function assertDisposableDatabase(value: string) {
  const url = new URL(value)
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/giving_pilot_test') {
    throw new Error('GIVING_MIGRATION_TEST_DATABASE_URL must target local database giving_pilot_test')
  }
}

describe.skipIf(!databaseUrl)('giving Rock alias reuse migration on PostgreSQL', () => {
  let client: Pool

  beforeAll(async () => {
    assertDisposableDatabase(databaseUrl!)
    client = new Pool({ connectionString: databaseUrl })
  })

  afterAll(async () => { await client?.end() })

  it('allows one Rock alias across checkouts while retaining BlinkPay uniqueness', async () => {
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE TABLE users(id serial PRIMARY KEY); CREATE TABLE payload_locked_documents_rels(id serial PRIMARY KEY);')
    await client.query(GIVING_PILOT_UP_SQL)
    await client.query(GIVING_CHECKOUT_ORCHESTRATION_UP_SQL)
    await client.query(GIVING_BANK_CODE_UP_SQL)
    await client.query(GIVING_BANK_ACKNOWLEDGEMENT_UP_SQL)
    await client.query(GIVING_ROCK_ALIAS_REUSE_UP_SQL)
    await client.query(GIVING_EMAIL_DELIVERIES_UP_SQL)
    await client.query("INSERT INTO giving_funds(id,name,code,accounting_key,is_default) VALUES(1,'General','GEN','general',true)")
    await client.query("INSERT INTO giving_givers(id,context_key,environment,synthetic,rock_person_alias_id,bank_reference,name,email) VALUES(1,'production','production',false,8604,'EV8604','Example Giver','giver@example.com')")
    await client.query("INSERT INTO giving_checkouts(id,context_key,environment,synthetic,giver_id,fund_id,fund_name,fund_code,fund_accounting_key,bank_code,amount_minor,frequency,correlation_key,status) VALUES(1,'production','production',false,1,1,'General','GEN','general','EGIVER',100,'one-off','checkout-1','draft'),(2,'production','production',false,1,1,'General','GEN','general','EGIVER',100,'one-off','checkout-2','draft')")

    await expect(client.query("INSERT INTO giving_provider_operations(context_key,environment,synthetic,checkout_id,provider,action,logical_version,request_digest,correlation_key,status,provider_id) VALUES('production','production',false,1,'rock','rock.resolve-giver',1,'digest-1','rock-alias:8604','succeeded','8604'),('production','production',false,2,'rock','rock.resolve-giver',1,'digest-2','rock-alias:8604','succeeded','8604')")).resolves.toBeDefined()

    await client.query("INSERT INTO giving_provider_operations(context_key,environment,synthetic,checkout_id,provider,action,logical_version,request_digest,correlation_key,request_id,idempotency_key,status,provider_id) VALUES('production','production',false,1,'blinkpay','blinkpay.create-payment',1,'payment-digest-1','payment-1','request-1','idempotency-1','succeeded','shared-provider-id')")
    await expect(client.query("INSERT INTO giving_provider_operations(context_key,environment,synthetic,checkout_id,provider,action,logical_version,request_digest,correlation_key,request_id,idempotency_key,status,provider_id) VALUES('production','production',false,2,'blinkpay','blinkpay.create-payment',1,'payment-digest-2','payment-2','request-2','idempotency-2','succeeded','shared-provider-id')")).rejects.toMatchObject({ code: '23505' })
  })

  it('rotates and acknowledges the capability for Rock-only identity recovery', async () => {
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE TABLE users(id serial PRIMARY KEY); CREATE TABLE payload_locked_documents_rels(id serial PRIMARY KEY);')
    await client.query(GIVING_PILOT_UP_SQL)
    await client.query(GIVING_CHECKOUT_ORCHESTRATION_UP_SQL)
    await client.query(GIVING_BANK_CODE_UP_SQL)
    await client.query(GIVING_BANK_ACKNOWLEDGEMENT_UP_SQL)
    await client.query(GIVING_ROCK_ALIAS_REUSE_UP_SQL)
    await client.query(GIVING_EMAIL_DELIVERIES_UP_SQL)
    await client.query("INSERT INTO giving_funds(id,name,code,accounting_key,is_default) VALUES(1,'General','GEN','general',true)")
    const repository = createPostgresGivingCheckoutRepository(client)
    const currentTime = new Date('2026-08-18T00:00:00Z')
    const input = {
      contextKey: 'production',
      environment: 'production' as const,
      synthetic: false,
      submission: {
        submissionKey: 'A'.repeat(43),
        amountMinor: 100,
        fundId: 1,
        frequency: 'one-off' as const,
        firstPaymentDate: null,
        firstName: 'Example',
        lastName: 'Giver',
        email: 'giver@example.com',
        turnstileToken: 'turnstile',
      },
      submissionKeyDigest: 'submission-key',
      submissionDigest: 'submission',
      correlationKey: 'checkout-correlation',
      returnCapabilityDigest: 'return-original',
      returnCapabilityExpiresAt: new Date('2026-08-18T00:30:00Z'),
      currentTime,
    }
    const created = await repository.createOrReuse(input)
    await client.query("INSERT INTO giving_provider_operations(context_key,environment,synthetic,checkout_id,provider,action,logical_version,request_digest,correlation_key,status) VALUES('production','production',false,$1,'rock','rock.resolve-giver',1,'identity-digest','rock-alias:8604','submitted')", [created.checkout.id])

    const recovered = await repository.createOrReuse({
      ...input,
      returnCapabilityDigest: 'return-retry',
      returnCapabilityExpiresAt: new Date('2026-08-18T00:45:00Z'),
    })
    expect(recovered.disposition).toBe('start')
    expect((await client.query('SELECT return_capability_digest FROM giving_checkouts WHERE id=$1', [created.checkout.id])).rows[0]?.return_capability_digest).toBe('return-retry')
    await expect(repository.acknowledgeBankSetup('return-retry', currentTime)).resolves.toBe(false)

    await client.query("INSERT INTO giving_givers(id,context_key,environment,synthetic,rock_person_alias_id,bank_reference,name,email) VALUES(1,'production','production',false,8604,'EV8604','Example Giver','giver@example.com')")
    await client.query('UPDATE giving_checkouts SET giver_id=1 WHERE id=$1', [created.checkout.id])
    await client.query("INSERT INTO giving_provider_operations(context_key,environment,synthetic,checkout_id,provider,action,logical_version,request_digest,correlation_key,request_id,idempotency_key,status) VALUES('production','production',false,$1,'blinkpay','blinkpay.create-payment',1,'payment-digest','payment-correlation','request-id','idempotency-key','failed')", [created.checkout.id])
    const mixedProviderRetry = await repository.createOrReuse({
      ...input,
      returnCapabilityDigest: 'return-after-blinkpay',
      returnCapabilityExpiresAt: new Date('2026-08-18T00:50:00Z'),
    })
    expect(mixedProviderRetry.disposition).toBe('recover')
  })
})
