import { unstable_cache } from 'next/cache'

import { CACHE_TAGS } from '@/lib/cache-tags'
import { getPayloadClient } from '@/lib/payload'

export interface PublicConnectGroup {
  id: number | string
  name: string
  publicName: string
  rockGroupGuid: string
  campus: {
    name: string
    slug: string
  }
  leaders: Array<{
    name: string
    avatarUrl: string | null
  }>
  meetingDay: number | null
  meetingTime: string | null
  scheduleText: string | null
}

function asPublicConnectGroup(value: unknown): PublicConnectGroup | null {
  if (!value || typeof value !== 'object') return null
  const group = value as Record<string, unknown>
  const campus = group.campus
  if (!campus || typeof campus !== 'object') return null

  const campusRecord = campus as Record<string, unknown>
  if (
    typeof group.id !== 'number' &&
    typeof group.id !== 'string'
  ) return null
  if (
    typeof group.name !== 'string' ||
    typeof group.rockGroupGuid !== 'string' ||
    typeof campusRecord.name !== 'string' ||
    typeof campusRecord.slug !== 'string'
  ) return null

  const rockOrigin = (() => {
    try {
      return new URL(process.env.ROCK_API_URL ?? 'https://home.ev.church/api').origin
    } catch {
      return 'https://home.ev.church'
    }
  })()
  const leaders = Array.isArray(group.leaders)
    ? group.leaders.flatMap((leader) => {
        if (!leader || typeof leader !== 'object') return []
        const leaderRecord = leader as Record<string, unknown>
        const name = leaderRecord.name
        if (typeof name !== 'string' || !name.trim()) return []
        const photoId = leaderRecord.photoId
        return [{
          name: name.trim(),
          avatarUrl:
            typeof photoId === 'number' && Number.isInteger(photoId) && photoId > 0
              ? `${rockOrigin}/GetAvatar.ashx?PhotoId=${photoId}&Size=96`
              : null,
        }]
      })
    : []

  return {
    id: group.id,
    name: group.name,
    publicName:
      typeof group.publicName === 'string' && group.publicName.trim()
        ? group.publicName.trim()
        : group.name,
    rockGroupGuid: group.rockGroupGuid.toLowerCase(),
    campus: {
      name: campusRecord.name,
      slug: campusRecord.slug,
    },
    leaders,
    meetingDay:
      typeof group.meetingDay === 'number' &&
      Number.isInteger(group.meetingDay) &&
      group.meetingDay >= 0 &&
      group.meetingDay <= 6
        ? group.meetingDay
        : null,
    meetingTime:
      typeof group.meetingTime === 'string' && group.meetingTime
        ? group.meetingTime
        : null,
    scheduleText:
      typeof group.scheduleText === 'string' && group.scheduleText.trim()
        ? group.scheduleText.trim()
        : null,
  }
}

async function fetchPublicConnectGroups(): Promise<PublicConnectGroup[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'connect-groups',
    depth: 1,
    limit: 500,
    pagination: false,
    select: {
      name: true,
      publicName: true,
      rockGroupGuid: true,
      campus: true,
      leaders: true,
      meetingDay: true,
      meetingTime: true,
      scheduleText: true,
    },
    where: { isActive: { equals: true } },
  })

  return result.docs
    .map(asPublicConnectGroup)
    .filter((group): group is PublicConnectGroup => group !== null)
    .sort((a, b) =>
      a.campus.name.localeCompare(b.campus.name) ||
      (a.meetingDay ?? 7) - (b.meetingDay ?? 7) ||
      (a.meetingTime ?? '').localeCompare(b.meetingTime ?? '') ||
      a.publicName.localeCompare(b.publicName),
    )
}

export const getPublicConnectGroups = unstable_cache(
  fetchPublicConnectGroups,
  ['public-connect-groups-v2'],
  { tags: [CACHE_TAGS.connectGroups], revalidate: 300 },
)
