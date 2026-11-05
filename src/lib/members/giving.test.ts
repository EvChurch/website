import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'

import { getRockDonationHistory } from './rock-donations'

vi.mock('./rock-donations', () => ({ getRockDonationHistory: vi.fn() }))

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
      paymentProvider: 'blinkpay',
                amount_minor: 10000,
                transaction_fee_minor: 50,
                frequency: 'weekly',
                next_payment_date: new Date('2026-09-03T00:00:00+12:00'),
                fund_name: 'General',
              }]
            : [],
        }
      }
      if (sql.includes('FROM giving_gifts gift')) {
        return {
          rows: [{
            id: 9,
            provider_payment_id: 'payment-9',
            provider_charge_id: 'charge-9',
            provider_invoice_id: 'invoice-9',
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
  afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks() })

  it('shows the signed-in member synthetic recurring gifts in sandbox previews', async () => {
    vi.stubEnv('BLINKPAY_DEFAULT_ENVIRONMENT', 'sandbox')
    const { pool, queries } = fakePool()

    const overview = await getMemberGivingOverview(actor, pool)

    expect(overview.recurringGifts).toEqual([{
      id: 3,
      paymentProvider: 'blinkpay',
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
      refundedMinor: null,
      refundPendingMinor: null,
      completedAt: '2026-09-02T01:00:00.000Z',
    }])
  })

  it('merges Rock donations into paginated history without changing recurring gifts or recent activity', async () => {
    vi.stubEnv('BLINKPAY_DEFAULT_ENVIRONMENT', 'production')
    vi.mocked(getRockDonationHistory).mockResolvedValue(Array.from({ length: 25 }, (_, index) => ({
      id: `rock:${index + 1}`, refundedMinor: null, refundPendingMinor: null, amountMinor: 5000, transactionFeeMinor: 0,
      frequency: '', giftType: 'Donation', fundName: 'General Fund', completedAt: '2026-08-01T00:00:00.000Z',
    })))
    const { pool } = fakePool()
    const overview = await getMemberGivingOverview(actor, pool)
    expect(overview.recurringGifts).toEqual([])
    expect(overview.recentActivity).toEqual([])
    expect(overview.giftHistory.totalPages).toBe(2)
    expect(overview.giftHistory.gifts).toHaveLength(25)
    expect(overview.giftHistory.gifts[0].id).toBe(9)
    expect(getRockDonationHistory).toHaveBeenCalledWith(actor.rockPersonId, new Set(['payment-9', 'charge-9', 'invoice-9']))
    const second = await getMemberGiftHistoryPage(actor, 2, pool)
    expect(second.gifts).toHaveLength(1)
    expect(second.gifts[0].id).not.toBe(9)
  })

  it('preserves website history and reports incomplete history if Rock is unavailable', async () => {
    vi.stubEnv('BLINKPAY_DEFAULT_ENVIRONMENT', 'production')
    vi.mocked(getRockDonationHistory).mockRejectedValue(new Error('unavailable'))
    const { pool } = fakePool()
    const history = await getMemberGiftHistoryPage(actor, 1, pool)
    expect(history.rockUnavailable).toBe(true)
    expect(history.gifts[0].id).toBe(9)
  })

  it('does not read real donations in sandbox previews', async () => {
    vi.stubEnv('BLINKPAY_DEFAULT_ENVIRONMENT', 'sandbox')
    const { pool } = fakePool()
    await getMemberGiftHistoryPage(actor, 1, pool)
    expect(getRockDonationHistory).not.toHaveBeenCalled()
  })

})
