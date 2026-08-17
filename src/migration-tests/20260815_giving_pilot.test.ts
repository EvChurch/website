import { describe, expect, it, vi } from 'vitest'

import { GIVING_PILOT_DOWN_SQL, GIVING_PILOT_UP_SQL, down, up } from '../migrations/20260815_170000_giving_pilot'

describe('giving pilot migration', () => {
  it('creates all aggregates, provenance constraints, and eight Payload lock relations', () => {
    for (const table of ['giving_funds', 'giving_givers', 'giving_checkouts', 'giving_gifts', 'giving_consents', 'giving_schedules', 'giving_provider_operations', 'blinkpay_webhook_events']) {
      expect(GIVING_PILOT_UP_SQL).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`)
      expect(GIVING_PILOT_UP_SQL).toContain(`"${table}_id" integer`)
    }
    expect(GIVING_PILOT_UP_SQL).toContain('amount_minor_positive_integer')
    expect(GIVING_PILOT_UP_SQL).toContain('giving_givers_provenance_valid')
    expect(GIVING_PILOT_UP_SQL).toContain('giving_gifts_payment_unique')
    expect(GIVING_PILOT_UP_SQL).toContain('giving_schedules_consent_unique')
    expect(GIVING_PILOT_UP_SQL).toContain('giving_provider_operations_semantic_unique')
    expect(GIVING_PILOT_UP_SQL).toContain('blinkpay_webhook_events_lease_valid')
    expect(GIVING_PILOT_UP_SQL).toContain('DEFERRABLE INITIALLY DEFERRED')
    expect(GIVING_PILOT_UP_SQL).toContain('attempt_number')
    expect(GIVING_PILOT_UP_SQL).toContain('giving_provider_operation_attempts_number_unique')
    expect(GIVING_PILOT_UP_SQL).not.toContain('"attempts" jsonb')
    expect(GIVING_PILOT_UP_SQL).toContain('9007199254740991')
    expect(GIVING_PILOT_UP_SQL).toContain("environment='sandbox' AND synthetic AND context_key='sandbox'")
    expect(GIVING_PILOT_UP_SQL).toContain('blinkpay_webhook_events_claim_idx')
    expect(GIVING_PILOT_UP_SQL).toContain('blinkpay_webhook_events_expired_lease_idx')
  })

  it('guards destructive down before any DDL and never seeds General', () => {
    expect(GIVING_PILOT_DOWN_SQL.indexOf('RAISE EXCEPTION')).toBeLessThan(GIVING_PILOT_DOWN_SQL.indexOf('DROP TABLE'))
    expect(GIVING_PILOT_UP_SQL).not.toMatch(/INSERT[\s\S]+General/i)
  })

  it('executes both directions atomically', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    await up({ db: { execute } } as never)
    await down({ db: { execute } } as never)
    expect(execute).toHaveBeenCalledTimes(2)
  })
})
