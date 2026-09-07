import { unstable_cache } from 'next/cache'
import type { Payload } from 'payload'
import { CACHE_TAGS } from '@/lib/cache-tags'
import type { PublicGivingFund } from './contracts'

function missingColumn(error: unknown, column: string) {
  let current = error
  while (current && typeof current === 'object') {
    const candidate = current as { cause?: unknown; code?: unknown; message?: unknown }
    if (candidate.code === '42703' && String(candidate.message).includes(column)) return true
    current = candidate.cause
  }
  return false
}

export async function getActiveGivingFunds(payload?: Payload): Promise<PublicGivingFund[]> {
  const client = payload ?? await (await import('@/lib/payload')).getPayloadClient()
  const query = {
    collection: 'giving-funds' as const, where: { active: { equals: true } }, sort: 'sortOrder', depth: 0, limit: 100,
  }
  try {
    const result = await client.find({
      ...query,
      select: { name: true, code: true, sortOrder: true, isDefault: true, apprenticeRelated: true, studentMinisterRelated: true },
    })
    return result.docs as PublicGivingFund[]
  } catch (error) {
    if (missingColumn(error, 'student_minister_related')) {
      try {
        const result = await client.find({
          ...query,
          select: { name: true, code: true, sortOrder: true, isDefault: true, apprenticeRelated: true },
        })
        return result.docs.map((fund) => ({ ...fund, studentMinisterRelated: false })) as PublicGivingFund[]
      } catch (fallbackError) {
        if (!missingColumn(fallbackError, 'apprentice_related')) throw fallbackError
      }
    } else if (!missingColumn(error, 'apprentice_related')) throw error
    const result = await client.find({
      ...query,
      select: { name: true, code: true, sortOrder: true, isDefault: true },
    })
    return result.docs.map((fund) => ({ ...fund, apprenticeRelated: false, studentMinisterRelated: false })) as PublicGivingFund[]
  }
}

export const getCachedActiveGivingFunds = unstable_cache(() => getActiveGivingFunds(), ['active-giving-funds-v2'], { tags: [CACHE_TAGS.givingFunds], revalidate: 300 })
