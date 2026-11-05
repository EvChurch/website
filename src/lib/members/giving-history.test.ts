import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Pool } from 'pg'

import { memberRockFetch } from '@/auth/member-rock-client'
import { getMemberGiftHistoryPage } from './giving'

vi.mock('@/auth/member-rock-client', () => ({ memberRockFetch: vi.fn() }))

const actor = { auth0Subject: 'auth0|donor', rockPersonId: 100, rockPersonAliasId: 200, email: null }

function websiteGift(id: number, fund: string, date: string) {
  return {
    id, provider_payment_id: `payment-${id}`, provider_charge_id: null, provider_invoice_id: null,
    payment_provider: 'blinkpay', amount_minor: '20000', transaction_fee_minor: '50',
    fund_name: fund, fund_code: fund === 'General' ? 'GEN' : 'BUILD', frequency: 'monthly',
    completed_at: new Date(date),
  }
}

function rockGift(id: number, fund: string, date: string) {
  return {
    Id: id, TransactionDateTime: `${date}T00:00:00`, TransactionCode: null, Status: null,
    ForeignKey: `finance-import-${id}`, FinancialGatewayId: null,
    AuthorizedPersonAlias: { PersonId: actor.rockPersonId },
    TransactionDetails: [{ Id: id, Amount: 200.5,
      Account: { Name: fund === 'Building' ? 'Investment Fund' : 'General Fund', PublicName: fund === 'Building' ? 'Building' : 'General Fund', IsTaxDeductible: true } }],
  }
}

const localGifts = [
  websiteGift(1, 'General', '2026-10-22T20:00:03Z'),
  websiteGift(2, 'Building', '2026-10-22T20:00:02Z'),
  websiteGift(3, 'General', '2026-09-22T21:00:03Z'),
  websiteGift(4, 'Building', '2026-09-22T21:00:02Z'),
]
const rockGifts = [
  rockGift(11, 'General', '2026-10-23'), rockGift(12, 'Building', '2026-10-23'),
  rockGift(13, 'General', '2026-09-23'), rockGift(14, 'Building', '2026-09-23'),
]

async function history(website = localGifts, rock: Array<Omit<ReturnType<typeof rockGift>, 'TransactionCode' | 'ForeignKey' | 'FinancialGatewayId'> & { TransactionCode: string | null; ForeignKey: string | null; FinancialGatewayId: number | null }> = rockGifts) {
  vi.stubEnv('BLINKPAY_DEFAULT_ENVIRONMENT', 'production')
  vi.mocked(memberRockFetch).mockResolvedValue(rock)
  const pool = { query: vi.fn().mockResolvedValue({ rows: website }) } as unknown as Pool
  return getMemberGiftHistoryPage(actor, 1, pool)
}

afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks() })

describe('combined member giving history', () => {
  it('shows four payments once when finance-imported Rock records include fees and use different fund names', async () => {
    const result = await history()
    expect(result.rockUnavailable).toBeUndefined()
    expect(result.gifts).toHaveLength(4)
    expect(result.gifts.every(gift => gift.amountMinor === 20000 && gift.transactionFeeMinor === 50)).toBe(true)
  })

  it('keeps imported donations that differ in amount, NZ day or fund', async () => {
    const wrongAmount = rockGift(11, 'General', '2026-10-23')
    wrongAmount.TransactionDetails[0].Amount = 200
    const wrongFund = rockGift(12, 'Building', '2026-10-23')
    const wrongDay = rockGift(13, 'General', '2026-10-24')
    const result = await history([localGifts[0]], [wrongAmount, wrongFund, wrongDay])
    expect(result.gifts).toHaveLength(4)
  })

  it('does not collapse multiple indistinguishable Rock donations', async () => {
    const result = await history([localGifts[0]], [rockGifts[0], rockGift(15, 'General', '2026-10-23')])
    expect(result.gifts).toHaveLength(3)
  })

  it('does not collapse multiple indistinguishable website payments', async () => {
    const result = await history([localGifts[0], websiteGift(5, 'General', '2026-10-22T20:00:04Z')], [rockGifts[0]])
    expect(result.gifts).toHaveLength(3)
  })

  it('keeps a separate imported donation when an exact provider ID already matches the website gift', async () => {
    const exact = { ...rockGifts[0], TransactionCode: 'payment-1' }
    const result = await history([localGifts[0]], [exact, rockGift(15, 'General', '2026-10-23')])
    expect(result.gifts).toHaveLength(2)
    expect(result.gifts.map(gift => gift.id)).toContain('rock:15')
  })

  it('does not guess a match for manual or gateway records without finance-import provenance', async () => {
    const manual = { ...rockGifts[0], ForeignKey: null }
    const gateway = { ...rockGift(15, 'General', '2026-10-23'), FinancialGatewayId: 1 }
    const result = await history([localGifts[0]], [manual, gateway])
    expect(result.gifts).toHaveLength(3)
  })

  it('does not guess a match when Rock has a different provider payment ID', async () => {
    const different = { ...rockGifts[0], TransactionCode: 'other-payment' }
    const result = await history([localGifts[0]], [different])
    expect(result.gifts).toHaveLength(2)
  })

})
