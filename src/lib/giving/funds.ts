import { unstable_cache } from 'next/cache'
import type { Payload } from 'payload'
import { CACHE_TAGS } from '@/lib/cache-tags'
import type { PublicGivingFund } from './contracts'

export async function getActiveGivingFunds(payload?: Payload): Promise<PublicGivingFund[]> {
  const client = payload ?? await (await import('@/lib/payload')).getPayloadClient()
  const result = await client.find({
    collection: 'giving-funds', where: { active: { equals: true } }, sort: 'sortOrder', depth: 0, limit: 100,
    select: { name: true, code: true, sortOrder: true, isDefault: true, apprenticeRelated: true },
  })
  return result.docs as PublicGivingFund[]
}

export const getCachedActiveGivingFunds = unstable_cache(() => getActiveGivingFunds(), ['active-giving-funds'], { tags: [CACHE_TAGS.givingFunds], revalidate: 300 })
