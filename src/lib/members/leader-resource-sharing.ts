import { randomBytes } from 'node:crypto'

import { getCurrentMemberProfile } from '@/auth/member-session'
import { getPayloadClient } from '@/lib/payload'
import type { MemberLeaderResource } from './data'

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/u

type PayloadResult = { docs: unknown[] }
interface SharingPayload {
  find(args: Record<string, unknown>): Promise<PayloadResult>
  create(args: Record<string, unknown>): Promise<unknown>
}

interface ShareRecord {
  token: string
  resourceRockId: number
  sharerRockPersonId: number
}

export interface PublicLeaderResourceShare {
  resource: MemberLeaderResource
  sharer: { name: string; avatarUrl: string | null } | null
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function positiveInteger(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}

function shareRecord(value: unknown): ShareRecord | null {
  const item = record(value)
  const token = text(item?.token)
  const resourceRockId = positiveInteger(item?.resourceRockId)
  const sharerRockPersonId = positiveInteger(item?.sharerRockPersonId)
  return token && resourceRockId && sharerRockPersonId
    ? { token, resourceRockId, sharerRockPersonId }
    : null
}

async function findShare(payload: SharingPayload, where: Record<string, unknown>) {
  const result = await payload.find({
    collection: 'leader-resource-shares', depth: 0, limit: 1,
    pagination: false, overrideAccess: true, where,
  })
  return shareRecord(result.docs[0])
}

function resourceFrom(value: unknown): MemberLeaderResource | null {
  const item = record(value)
  const rockId = positiveInteger(item?.rockId)
  const title = text(item?.title)
  if (!rockId || !title) return null
  const hosts = Array.isArray(item?.hosts) ? item.hosts : []
  const leaderNotes = record(item?.leaderNotesFile)
  const memberStudy = record(item?.memberStudyFile)
  return {
    rockId,
    title,
    startDateTime: text(item?.startDateTime),
    expireDateTime: text(item?.expireDateTime),
    description: text(item?.description),
    youtubeUrl: text(item?.youtubeUrl),
    promotionalImageUrl: null,
    hosts: hosts.map(record).map((host) => ({ name: text(host?.name), avatarUrl: null }))
      .filter((host): host is { name: string; avatarUrl: null } => Boolean(host.name)),
    bibleReference: text(item?.bibleReference),
    hasLeaderNotes: Boolean(text(leaderNotes?.guid) && text(leaderNotes?.name)),
    hasMemberStudy: Boolean(text(memberStudy?.guid) && text(memberStudy?.name)),
    campusNames: [], priority: 0, sourceOrder: 0,
  }
}

export function isLeaderResourceShareToken(token: string) {
  return TOKEN_PATTERN.test(token)
}

export async function createOrReuseLeaderResourceShare(
  resourceRockId: number,
): Promise<string | null> {
  const profile = await getCurrentMemberProfile({ persistLegacyProfile: true })
  if (!profile || !positiveInteger(resourceRockId)) return null
  const payload = (await getPayloadClient()) as unknown as SharingPayload
  const participantResult = await payload.find({
    collection: 'connect-group-participants', depth: 0, limit: 1,
    pagination: false, overrideAccess: true,
    select: { isCoach: true, memberships: true },
    where: { rockPersonId: { equals: profile.personId } },
  })
  const participant = record(participantResult.docs[0])
  const memberships = Array.isArray(participant?.memberships) ? participant.memberships : []
  const isLeader = memberships.some((membership) => record(membership)?.isLeader === true)
  if (!isLeader) return null

  // Reuse the existing member boundary so campus and approval access remain authoritative.
  const { getMemberResourceDetail } = await import('./data')
  const detail = await getMemberResourceDetail(resourceRockId)
  if (!detail || detail.access !== 'granted') return null

  const pairKey = `${resourceRockId}:${profile.personId}`
  const existing = await findShare(payload, { pairKey: { equals: pairKey } })
  if (existing) return existing.token

  const token = randomBytes(24).toString('base64url')
  try {
    const created = await payload.create({
      collection: 'leader-resource-shares', overrideAccess: true,
      data: { token, pairKey, resourceRockId, sharerRockPersonId: profile.personId },
    })
    return shareRecord(created)?.token ?? null
  } catch {
    // A concurrent first click may win the pair uniqueness race.
    return (await findShare(payload, { pairKey: { equals: pairKey } }))?.token ?? null
  }
}

export async function getPublicLeaderResourceShare(token: string): Promise<PublicLeaderResourceShare | null> {
  if (!isLeaderResourceShareToken(token)) return null
  const payload = (await getPayloadClient()) as unknown as SharingPayload
  const share = await findShare(payload, { token: { equals: token } })
  if (!share) return null
  const [resourceResult, participantResult] = await Promise.all([
    payload.find({
      collection: 'connect-group-leader-resources', depth: 0, limit: 1,
      pagination: false, overrideAccess: true,
      select: { rockId: true, title: true, startDateTime: true, expireDateTime: true, youtubeUrl: true, description: true, hosts: true, bibleReference: true, leaderNotesFile: true, memberStudyFile: true },
      where: { rockId: { equals: share.resourceRockId } },
    }),
    payload.find({
      collection: 'connect-group-participants', depth: 0, limit: 1,
      pagination: false, overrideAccess: true,
      select: { name: true, photoId: true },
      where: { rockPersonId: { equals: share.sharerRockPersonId } },
    }),
  ])
  const resource = resourceFrom(resourceResult.docs[0])
  if (!resource) return null
  const participant = record(participantResult.docs[0])
  const name = text(participant?.name)
  const photoId = positiveInteger(participant?.photoId)
  return {
    resource,
    sharer: name ? { name, avatarUrl: photoId ? `/shared/leader-resources/${token}/avatar` : null } : null,
  }
}

export async function getPublicLeaderResourceAsset(token: string, kind: 'notes' | 'avatar') {
  if (!isLeaderResourceShareToken(token)) return null
  const payload = (await getPayloadClient()) as unknown as SharingPayload
  const share = await findShare(payload, { token: { equals: token } })
  if (!share) return null
  const collection = kind === 'notes' ? 'connect-group-leader-resources' : 'connect-group-participants'
  const where = kind === 'notes'
    ? { rockId: { equals: share.resourceRockId } }
    : { rockPersonId: { equals: share.sharerRockPersonId } }
  const select = kind === 'notes' ? { leaderNotesFile: true } : { photoId: true }
  const result = await payload.find({ collection, depth: 0, limit: 1, pagination: false, overrideAccess: true, select, where })
  const item = record(result.docs[0])
  if (!item) return null
  if (kind === 'avatar') {
    const photoId = positiveInteger(item.photoId)
    return photoId ? { kind, photoId } as const : null
  }
  const file = record(item.leaderNotesFile)
  const guid = text(file?.guid)
  const name = text(file?.name)
  return guid && name ? { kind, guid: guid.toLowerCase(), name } as const : null
}
