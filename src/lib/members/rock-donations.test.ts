import { afterEach, describe, expect, it, vi } from 'vitest'

import { memberRockFetch } from '@/auth/member-rock-client'
import { getRockDonationHistory } from './rock-donations'

vi.mock('@/auth/member-rock-client', () => ({ memberRockFetch: vi.fn() }))
const fetch = vi.mocked(memberRockFetch)

function transaction(id = 1) {
  return {
    Id: id,
    TransactionDateTime: '2026-11-03T00:00:00',
    TransactionCode: null as string | null,
    Status: null as string | null,
    AuthorizedPersonAlias: { PersonId: 100 },
    TransactionDetails: [{ Id: id, Amount: 50, Account: { Name: 'General Fund', IsTaxDeductible: true } }],
  }
}

afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks() })

describe('Rock donation history', () => {
  it('reads contributions for the signed-in person and maps NZ dates and fund allocations', async () => {
    const gift = transaction()
    gift.TransactionDetails.push({ Id: 2, Amount: 12.34, Account: { Name: 'Building', IsTaxDeductible: true } })
    fetch.mockResolvedValue([gift])
    const gifts = await getRockDonationHistory(100, new Set())
    expect(gifts).toEqual([
      { id: 'rock:1', refundedMinor: null, refundPendingMinor: null, amountMinor: 5000, transactionFeeMinor: 0, frequency: '', giftType: 'Donation', fundName: 'General Fund', completedAt: '2026-11-02T11:00:00.000Z' },
      { id: 'rock:2', refundedMinor: null, refundPendingMinor: null, amountMinor: 1234, transactionFeeMinor: 0, frequency: '', giftType: 'Donation', fundName: 'Building', completedAt: '2026-11-02T11:00:00.000Z' },
    ])
    expect(fetch.mock.calls[0][0].params?.$filter).toBe("AuthorizedPersonAlias/PersonId eq 100 and TransactionTypeValue/Guid eq guid'2d607262-52d6-4724-910d-5c6e8fb89acc'")
  })

  it('excludes non-donation accounts, non-positive allocations and unconfirmed gateway transactions', async () => {
    const registration = transaction(1)
    registration.TransactionDetails[0].Account.IsTaxDeductible = false
    const refund = transaction(2)
    refund.TransactionDetails[0].Amount = -50
    const zero = transaction(3)
    zero.TransactionDetails[0].Amount = 0
    const pending = transaction(4)
    pending.Status = 'Pending'
    const failed = transaction(5)
    failed.Status = 'Failed'
    const complete = transaction(6)
    complete.Status = 'Complete'
    fetch.mockResolvedValue([registration, refund, zero, pending, failed, complete])
    expect((await getRockDonationHistory(100, new Set())).map(gift => gift.id)).toEqual(['rock:6'])
  })

  it('deduplicates exact website payment IDs without conflating identical weekly gifts', async () => {
    const duplicate = transaction(1)
    duplicate.TransactionCode = 'payment-1'
    fetch.mockResolvedValue([duplicate, transaction(2), transaction(3)])
    expect((await getRockDonationHistory(100, new Set(['payment-1']))).map(gift => gift.id)).toEqual(['rock:2', 'rock:3'])
  })

  it('rejects another person’s donations even if Rock ignores the owner filter', async () => {
    const other = transaction()
    other.AuthorizedPersonAlias.PersonId = 101
    fetch.mockResolvedValue([other])
    await expect(getRockDonationHistory(100, new Set())).rejects.toThrow('ownership')
  })

  it('advances provider pages and rejects repeated pages', async () => {
    const first = Array.from({ length: 100 }, (_, index) => transaction(index + 1))
    fetch.mockResolvedValueOnce(first).mockResolvedValueOnce([transaction(101)])
    expect(await getRockDonationHistory(100, new Set())).toHaveLength(101)
    expect(fetch.mock.calls[1][0].params?.$skip).toBe('100')
    fetch.mockReset().mockResolvedValue(first)
    await expect(getRockDonationHistory(100, new Set())).rejects.toThrow('pagination')
  })

  it('handles winter, summer, fractional seconds and explicitly zoned dates independently of server timezone', async () => {
    const winter = transaction(1)
    winter.TransactionDateTime = '2026-08-11T00:00:00.1234567'
    const zoned = transaction(2)
    zoned.TransactionDateTime = '2026-11-03T00:00:00+13:00'
    fetch.mockResolvedValue([winter, zoned])
    expect((await getRockDonationHistory(100, new Set())).map(gift => gift.completedAt)).toEqual(['2026-08-10T12:00:00.000Z', '2026-11-02T11:00:00.000Z'])
  })

  it('fails closed on invalid data and invalid member IDs', async () => {
    fetch.mockResolvedValue([{ ...transaction(), TransactionDetails: null }])
    await expect(getRockDonationHistory(100, new Set())).rejects.toThrow()
    fetch.mockClear()
    await expect(getRockDonationHistory(Number.NaN, new Set())).rejects.toThrow('owner')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('bounds the complete read duration across provider pages', async () => {
    const clock = vi.spyOn(Date, 'now')
    clock.mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(8_001)
    fetch.mockResolvedValue(Array.from({ length: 100 }, (_, index) => transaction(index + 1)))
    await expect(getRockDonationHistory(100, new Set())).rejects.toThrow('timed out')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0].timeoutMs).toBe(5_000)
  })

})
