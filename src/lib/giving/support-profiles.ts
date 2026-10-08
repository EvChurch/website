import { unstable_cache } from 'next/cache'
import type { Payload } from 'payload'
import type { PayloadMediaImage } from '@/lib/payload-media'
import { CACHE_TAGS } from '@/lib/cache-tags'

export interface PublicSupportProfile {
  id: number
  name: string
  slug: string
  group: 'apprentices' | 'student-ministers'
  photo: PayloadMediaImage | null
  blurb: string
  email: string
  fundId: number | null
  fundName: string | null
}

export async function getPublicSupportProfiles(payload?: Payload): Promise<PublicSupportProfile[]> {
  const client = payload ?? await (await import('@/lib/payload')).getPayloadClient()
  const [profiles, funds] = await Promise.all([
    client.find({ collection: 'support-profiles', where: { published: { equals: true } }, depth: 1, limit: 100, sort: 'sortOrder', select: { name: true, slug: true, group: true, photo: true, blurb: true, email: true } }),
    client.find({ collection: 'giving-funds', where: { active: { equals: true } }, depth: 0, limit: 100, select: { name: true, supportProfile: true } }),
  ])
  return profiles.docs.map((profile) => {
    const fund = funds.docs.find((candidate) => candidate.supportProfile === profile.id)
    return {
      id: profile.id, name: profile.name, slug: profile.slug, group: profile.group,
      photo: profile.photo && typeof profile.photo === 'object' ? profile.photo : null,
      blurb: profile.blurb ?? '', email: profile.email ?? '', fundId: fund?.id ?? null, fundName: fund?.name ?? null,
    }
  })
}

export const getCachedPublicSupportProfiles = unstable_cache(() => getPublicSupportProfiles(), ['public-support-profiles'], { tags: [CACHE_TAGS.supportProfiles, CACHE_TAGS.givingFunds], revalidate: 300 })
