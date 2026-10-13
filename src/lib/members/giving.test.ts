import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'

import { getMemberGiftHistoryPage, getMemberGivingOverview, type MemberGivingActor } from './giving'

const actor: MemberGivingActor = {
  auth0Subject: 'auth0|member',
  rockPersonId: 100,
  rockPersonAliasId: 200,
  email: 'tataihono@evchurch.nz',
}

function fakePool() {
  const queries: Array<{ sql: string; params: unknown[] }> = []
  const pool = {
    async query(sql: string, params: unknown[] = []) {
      queries.push({ sql, params })
      if (sql.includes('FROM giving_schedules schedule') && sql.includes("schedule.status='active'")) {
        return {
          rows: params[0] === 'sandbox' && params[1] === 'sandbox' && params[2] === true && params[4] === actor.email
            ? [{
                id: 3,
                amount_minor: 10000,
                transaction_fee_minor: 50,
                frequency: 'weekly',
                next_payment_date: new Date('2026-09-03T00:00:00+12:00'),
                fund_name: 'General',
              }]
            : [],
        }
      }
      if (sql.includes('count(*)::text count')) return { rows: [{ count: '1' }] }
      if (sql.includes('FROM giving_gifts gift')) {
        return {
          rows: [{
            id: 9,
            amount_minor: 2500,
            transaction_fee_minor: 50,
            fund_name: 'General',
            frequency: 'one-off',
            schedule_id: null,
            completed_at: new Date('2026-09-02T13:00:00+12:00'),
          }],
        }
      }
      return { rows: [] }
    },
  }
  return { pool: pool as unknown as Pool, queries }
}

describe('member giving overview', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('shows the signed-in member synthetic recurring gifts in sandbox previews', async () => {
    vi.stubEnv('BLINKPAY_DEFAULT_ENVIRONMENT', 'sandbox')
    const { pool, queries } = fakePool()

    const overview = await getMemberGivingOverview(actor, pool)

    expect(overview.recurringGifts).toEqual([{
      id: 3,
      amountMinor: 10000,
      transactionFeeMinor: 50,
      frequency: 'weekly',
      fundName: 'General',
      nextPaymentDate: '2026-09-02T12:00:00.000Z',
    }])
    expect(queries.some(({ params }) => (
      params[0] === 'sandbox' &&
      params[1] === 'sandbox' &&
      params[2] === true &&
      params[4] === actor.email
    ))).toBe(true)
  })

  it('includes settled gift transaction fees in member history', async () => {
    vi.stubEnv('BLINKPAY_DEFAULT_ENVIRONMENT', 'sandbox')
    const { pool } = fakePool()

    const history = await getMemberGiftHistoryPage(actor, 1, pool)

    expect(history.gifts).toEqual([{
      id: 9,
      amountMinor: 2500,
      transactionFeeMinor: 50,
      frequency: 'one-off',
      fundName: 'General',
      giftType: 'One-off',
      completedAt: '2026-09-02T01:00:00.000Z',
    }])
  })
})
