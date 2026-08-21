import { describe, expect, it } from 'vitest'

import { migrations } from '../migrations'
import { GIVING_EMAIL_DELIVERIES_DOWN_SQL, GIVING_EMAIL_DELIVERIES_UP_SQL } from '../migrations/20260822_010000_giving_email_deliveries'

describe('giving email deliveries migration',()=>{
  it('adds durable idempotent delivery state and Payload job slugs',()=>{
    expect(GIVING_EMAIL_DELIVERIES_UP_SQL).toContain('UNIQUE(checkout_id, kind)')
    expect(GIVING_EMAIL_DELIVERIES_UP_SQL).toContain("'bank-transfer-details','bank-transfer-thanks','blinkpay-thanks'")
    expect(GIVING_EMAIL_DELIVERIES_UP_SQL).toContain("ADD VALUE IF NOT EXISTS 'sendGivingEmail'")
    expect(migrations.at(-1)?.name).toBe('20260822_010000_giving_email_deliveries')
  })
  it('refuses rollback when any giving email data exists',()=>{
    expect(GIVING_EMAIL_DELIVERIES_DOWN_SQL).toContain('SELECT 1 FROM giving_email_deliveries LIMIT 1')
    expect(GIVING_EMAIL_DELIVERIES_DOWN_SQL).toContain('bank_details_prepared_at IS NOT NULL')
  })
})
