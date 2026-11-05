import { z } from 'zod'

import { memberRockFetch } from '@/auth/member-rock-client'
import type { MemberGiftHistoryItem } from './giving'

// Rock's system Contribution defined value; IDs differ between installations.
const CONTRIBUTION_TYPE_GUID = '2d607262-52d6-4724-910d-5c6e8fb89acc'
const PAGE_SIZE = 100
const MAX_PAGES = 100
const READ_BUDGET_MS = 8_000

interface RockDonationTransaction {
  Id: number
  TransactionDateTime: string
  TransactionCode: string | null
  Status: string | null
  ForeignKey?: string | null
  FinancialGatewayId?: number | null
  AuthorizedPersonAlias: { PersonId: number }
  TransactionDetails: Array<{
    Id: number
    Amount: number
    Account: { Name: string; PublicName?: string | null; IsTaxDeductible: boolean }
  }>
}

const transactionSchema = z.object({
  Id: z.number().int().positive(),
  TransactionDateTime: z.string(),
  TransactionCode: z.string().nullable(),
  Status: z.string().nullable(),
  ForeignKey: z.string().nullable().optional(),
  FinancialGatewayId: z.number().int().positive().nullable().optional(),
  AuthorizedPersonAlias: z.object({ PersonId: z.number().int().positive() }),
  TransactionDetails: z.array(z.object({
    Id: z.number().int().positive(),
    Amount: z.number().finite(),
    Account: z.object({ Name: z.string(), PublicName: z.string().nullable().optional(), IsTaxDeductible: z.boolean() }),
  })),
}) satisfies z.ZodType<RockDonationTransaction>

const aucklandDateTime = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

function wallTime(date: Date) {
  const parts = Object.fromEntries(aucklandDateTime.formatToParts(date)
    .filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]))
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
}

/** Rock serializes local NZ dates without an offset. Never use the server's timezone. */
function donationDate(value: string) {
  if (/(?:Z|[+-]\d{2}:\d{2})$/iu.test(value)) {
    const date = new Date(value)
    if (Number.isFinite(date.getTime())) return date.toISOString()
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?$/u.test(value)) {
    const desired = Math.floor(Date.parse(`${value}Z`) / 1_000) * 1_000
    if (Number.isFinite(desired)) {
      let instant = desired
      // Re-evaluate the offset for dates near a daylight-saving transition.
      for (let attempt = 0; attempt < 3; attempt++) {
        instant += desired - wallTime(new Date(instant))
        if (wallTime(new Date(instant)) === desired) return new Date(instant).toISOString()
      }
    }
  }
  throw new Error('Invalid Rock donation date')
}

type WebsiteDonationMatch = Pick<MemberGiftHistoryItem, 'amountMinor' | 'transactionFeeMinor' | 'fundName' | 'completedAt'> & { paymentIds?: readonly string[] }

const donationDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit',
})

function matchKey(fundName: string, completedAt: string, amountMinor: number) {
  const fund = fundName.normalize('NFKC').trim().toLowerCase().replace(/\s+fund$/u, '').replace(/\s+/gu, ' ')
  return JSON.stringify([fund, donationDay.format(new Date(completedAt)), amountMinor])
}

interface DonationCandidate {
  gift: MemberGiftHistoryItem
  matchKeys: string[]
}

function unmatchedDonations(candidates: DonationCandidate[], websiteGifts: readonly WebsiteDonationMatch[], matchedPaymentIds: ReadonlySet<string>) {
  const websiteCounts = new Map<string, number>()
  for (const gift of websiteGifts) {
    if (gift.paymentIds?.some(id => matchedPaymentIds.has(id))) continue
    const key = matchKey(gift.fundName, gift.completedAt, gift.amountMinor + gift.transactionFeeMinor)
    websiteCounts.set(key, (websiteCounts.get(key) ?? 0) + 1)
  }
  const rockCounts = new Map<string, number>()
  for (const candidate of candidates) {
    for (const key of candidate.matchKeys) rockCounts.set(key, (rockCounts.get(key) ?? 0) + 1)
  }
  return candidates.filter(candidate => {
    const matches = candidate.matchKeys.filter(key => websiteCounts.has(key))
    // Only a unique one-to-one match can suppress an imported allocation.
    return matches.length !== 1 || websiteCounts.get(matches[0]) !== 1 || rockCounts.get(matches[0]) !== 1
  }).map(candidate => candidate.gift)
}

export async function getRockDonationHistory(
  personId: number,
  websitePaymentIds: ReadonlySet<string>,
  websiteGifts: readonly WebsiteDonationMatch[] = [],
): Promise<MemberGiftHistoryItem[]> {
  if (!Number.isSafeInteger(personId) || personId <= 0) throw new Error('Invalid donation owner')
  const deadline = Date.now() + READ_BUDGET_MS
  const candidates: DonationCandidate[] = []
  const transactionIds = new Set<number>()
  const matchedPaymentIds = new Set<string>()
  for (let page = 0; page < MAX_PAGES; page++) {
    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) throw new Error('Rock donation history read timed out')
    const response = await memberRockFetch<unknown>({
      timeoutMs: Math.min(5_000, remainingMs),
      endpoint: 'FinancialTransactions',
      params: {
        $filter: `AuthorizedPersonAlias/PersonId eq ${personId} and TransactionTypeValue/Guid eq guid'${CONTRIBUTION_TYPE_GUID}'`,
        $expand: 'TransactionDetails/Account,AuthorizedPersonAlias',
        $select: 'Id,TransactionDateTime,TransactionCode,Status,ForeignKey,FinancialGatewayId,AuthorizedPersonAlias/PersonId,TransactionDetails/Id,TransactionDetails/Amount,TransactionDetails/Account/Name,TransactionDetails/Account/PublicName,TransactionDetails/Account/IsTaxDeductible',
        $orderby: 'TransactionDateTime desc,Id desc',
        $top: String(PAGE_SIZE),
        $skip: String(page * PAGE_SIZE),
      },
    })
    const transactions = z.array(transactionSchema).parse(response)
    for (const transaction of transactions) {
      if (transaction.AuthorizedPersonAlias.PersonId !== personId || transactionIds.has(transaction.Id)) {
        throw new Error('Invalid Rock donation ownership or pagination')
      }
      transactionIds.add(transaction.Id)
      // A shared provider identifier is the strongest match, regardless of imported dates or fund labels.
      if (transaction.TransactionCode && websitePaymentIds.has(transaction.TransactionCode)) {
        matchedPaymentIds.add(transaction.TransactionCode)
        continue
      }
      if (transaction.Status && transaction.Status.toLowerCase() !== 'complete') continue
      for (const detail of transaction.TransactionDetails) {
        if (!detail.Account.IsTaxDeductible || detail.Amount <= 0) continue
        const amountMinor = Math.round(detail.Amount * 100)
        if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error('Invalid Rock donation amount')
        const completedAt = donationDate(transaction.TransactionDateTime)
        const imported = !transaction.TransactionCode && Boolean(transaction.ForeignKey) && transaction.FinancialGatewayId == null
        const fundNames = [detail.Account.Name, detail.Account.PublicName].filter((name): name is string => Boolean(name))
        candidates.push({ matchKeys: imported ? [...new Set(fundNames.map(name => matchKey(name, completedAt, amountMinor)))] : [], gift: {
          id: `rock:${detail.Id}`,
          refundedMinor: null,
          refundPendingMinor: null,
          amountMinor,
          transactionFeeMinor: 0,
          frequency: '',
          fundName: detail.Account.Name,
          giftType: 'Donation',
          completedAt,
        } })
      }
    }
    if (transactions.length < PAGE_SIZE) return unmatchedDonations(candidates, websiteGifts, matchedPaymentIds)
  }
  // Do not silently present an incomplete history if the provider ignores pagination.
  throw new Error('Rock donation history exceeded its read limit')
}
