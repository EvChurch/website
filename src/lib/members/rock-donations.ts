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
  AuthorizedPersonAlias: { PersonId: number }
  TransactionDetails: Array<{
    Id: number
    Amount: number
    Account: { Name: string; IsTaxDeductible: boolean }
  }>
}

const transactionSchema = z.object({
  Id: z.number().int().positive(),
  TransactionDateTime: z.string(),
  TransactionCode: z.string().nullable(),
  Status: z.string().nullable(),
  AuthorizedPersonAlias: z.object({ PersonId: z.number().int().positive() }),
  TransactionDetails: z.array(z.object({
    Id: z.number().int().positive(),
    Amount: z.number().finite(),
    Account: z.object({ Name: z.string(), IsTaxDeductible: z.boolean() }),
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

export async function getRockDonationHistory(
  personId: number,
  websitePaymentIds: ReadonlySet<string>,
): Promise<MemberGiftHistoryItem[]> {
  if (!Number.isSafeInteger(personId) || personId <= 0) throw new Error('Invalid donation owner')
  const deadline = Date.now() + READ_BUDGET_MS
  const gifts: MemberGiftHistoryItem[] = []
  const transactionIds = new Set<number>()
  for (let page = 0; page < MAX_PAGES; page++) {
    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) throw new Error('Rock donation history read timed out')
    const response = await memberRockFetch<unknown>({
      timeoutMs: Math.min(5_000, remainingMs),
      endpoint: 'FinancialTransactions',
      params: {
        $filter: `AuthorizedPersonAlias/PersonId eq ${personId} and TransactionTypeValue/Guid eq guid'${CONTRIBUTION_TYPE_GUID}'`,
        $expand: 'TransactionDetails/Account,AuthorizedPersonAlias',
        $select: 'Id,TransactionDateTime,TransactionCode,Status,AuthorizedPersonAlias/PersonId,TransactionDetails/Id,TransactionDetails/Amount,TransactionDetails/Account/Name,TransactionDetails/Account/IsTaxDeductible',
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
      // Only exact payment identifiers establish a duplicate. Dates and amounts do not.
      if (transaction.TransactionCode && websitePaymentIds.has(transaction.TransactionCode)) continue
      if (transaction.Status && transaction.Status.toLowerCase() !== 'complete') continue
      for (const detail of transaction.TransactionDetails) {
        if (!detail.Account.IsTaxDeductible || detail.Amount <= 0) continue
        const amountMinor = Math.round(detail.Amount * 100)
        if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error('Invalid Rock donation amount')
        gifts.push({
          id: `rock:${detail.Id}`,
          refundedMinor: null,
          refundPendingMinor: null,
          amountMinor,
          transactionFeeMinor: 0,
          frequency: '',
          fundName: detail.Account.Name,
          giftType: 'Donation',
          completedAt: donationDate(transaction.TransactionDateTime),
        })
      }
    }
    if (transactions.length < PAGE_SIZE) return gifts
  }
  // Do not silently present an incomplete history if the provider ignores pagination.
  throw new Error('Rock donation history exceeded its read limit')
}
