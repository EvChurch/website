import { unstable_cache } from 'next/cache'
import type { Payload } from 'payload'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { DEFAULT_GIVING_TRANSACTION_FEE_MINOR } from './fees'
import type { CardFeeSettings } from './fees'

export async function getGivingCardFees(payload?: Payload): Promise<CardFeeSettings> {
  const client = payload ?? await (await import('@/lib/payload')).getPayloadClient()
  const settings = await client.findGlobal({ slug: 'giving-settings', depth: 0 })
  return { fixedMinor: settings.cardFixedMinor, percentageBasisPoints: settings.cardPercentageBasisPoints }
}

export const getCachedGivingCardFees = unstable_cache(() => getGivingCardFees(), ['giving-card-fees'], { tags: [CACHE_TAGS.givingSettings], revalidate: 300 })

export async function getGivingTransactionFeeMinor(payload?: Payload): Promise<number> {
  const client = payload ?? await (await import('@/lib/payload')).getPayloadClient()
  const settings = await client.findGlobal({ slug: 'giving-settings', depth: 0 })
  const value = settings.transactionFeeMinor
  return Number.isSafeInteger(value) && value >= 0 ? value : DEFAULT_GIVING_TRANSACTION_FEE_MINOR
}

export const getCachedGivingTransactionFeeMinor = unstable_cache(
  () => getGivingTransactionFeeMinor(),
  ['giving-transaction-fee'],
  { tags: [CACHE_TAGS.givingSettings], revalidate: 300 },
)
