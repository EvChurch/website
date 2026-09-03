import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'

import { getMemberGivingOverview, type MemberGivingActor } from './giving'

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
                frequency: 'weekly',
                next_payment_date: new Date('2026-09-03T00:00:00+12:00'),
                fund_name: 'General',
              }]
            : [],
        }
      }
      if (sql.includes('count(*)::text count')) return { rows: [{ count: '0' }] }
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
})
