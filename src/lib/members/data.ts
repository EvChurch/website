import { getCurrentMemberProfile } from '@/auth/member-session'
import { getPayloadClient } from '@/lib/payload'
import type {
  ConnectGroup,
  ConnectGroupLeaderResource,
  ConnectGroupParticipant,
} from '@/payload-types'
import { cache } from 'react'

type PayloadFindResult = { docs: unknown[] }

interface MemberPayloadClient {
  find(args: Record<string, unknown>): Promise<PayloadFindResult>
}

interface RelationRecord {
  id?: number | string
  name?: string | null
  slug?: string | null
}

type ParticipantMembershipRecord = ConnectGroupParticipant['memberships'][number]
type ParticipantRecord = Partial<ConnectGroupParticipant>
type ConnectGroupRecord = Partial<ConnectGroup>
type ResourceFileRecord = Partial<ConnectGroupLeaderResource['leaderNotesFile']>
type ResourceRecord = Partial<ConnectGroupLeaderResource>

export interface MemberPortalProfile {
  personId: number
  name: string
  email: string
  avatarUrl: string | null
}

export interface MemberGroupSummary {
  rockGroupId: number
  name: string
  campusName: string | null
  campusSlug: string | null
  locationName: string | null
  locationAddress: string | null
  isLeader: boolean
  roleName: string
}

export interface MemberRosterPerson {
  rockPersonId: number
  name: string
  email: string | null
  phones: Array<{
    number: string
    typeValueId: number | null
    isMessagingEnabled: boolean
  }>
  avatarUrl: string | null
  roleName: string
  isLeader: boolean
  isCurrentMember: boolean
}

export interface MemberLeaderResource {
  rockId: number
  title: string
  startDateTime: string | null
  expireDateTime: string | null
  description: string | null
  youtubeUrl: string | null
  promotionalImageUrl: string | null
  hosts: Array<{
    name: string
    avatarUrl: string | null
  }>
  bibleReference: string | null
  hasLeaderNotes: boolean
  hasMemberStudy: boolean
  campusNames: string[]
  priority: number
  sourceOrder: number
}

export interface MemberPortalHome {
  profile: MemberPortalProfile
  groups: MemberGroupSummary[]
  canAccessLeaderResources: boolean
}

export type MemberGroupDetailResult =
  | { access: 'denied' }
  | {
      access: 'granted'
      group: MemberGroupSummary
      people: MemberRosterPerson[]
    }

export type MemberResourcesResult =
  | { access: 'denied' }
  | {
      access: 'granted'
      current: MemberLeaderResource[]
      upcoming: MemberLeaderResource[]
      history: MemberLeaderResource[]
    }

export type MemberResourceDetailResult =
  | { access: 'denied' }
  | { access: 'granted'; resource: MemberLeaderResource }

export type MemberResourceAsset =
  | { kind: 'image'; guid: string }
  | { kind: 'avatar'; photoId: number }
  | { kind: 'file'; guid: string; name: string }

export type MemberResourceAssetRequest =
  | { kind: 'image' }
  | { kind: 'host-avatar'; index: number }
  | { kind: 'leader-notes' | 'member-study' }

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : null
}

function relation(value: unknown): RelationRecord | null {
  return record(value) as RelationRecord | null
}

function positiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : null
}

function nonemptyText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function membershipFor(
  participant: ParticipantRecord,
  rockGroupId: number,
): ParticipantMembershipRecord | null {
  return participant.memberships?.find(
    (membership) => membership.rockGroupId === rockGroupId,
  ) ?? null
}

function participantFrom(value: unknown): ParticipantRecord {
  return (record(value) as ParticipantRecord | null) ?? {}
}

function groupFrom(value: unknown): ConnectGroupRecord {
  return (record(value) as ConnectGroupRecord | null) ?? {}
}

function resourceFrom(value: unknown): ResourceRecord {
  return (record(value) as ResourceRecord | null) ?? {}
}

function campusId(value: unknown): string | null {
  const related = relation(value)
  const id = related?.id ?? (typeof value === 'number' || typeof value === 'string' ? value : null)
  return id === null || id === undefined ? null : String(id)
}

function toMemberGroup(
  group: ConnectGroupRecord,
  membership: ParticipantMembershipRecord,
): MemberGroupSummary | null {
  const rockGroupId = positiveInteger(group.rockGroupId)
  const name = nonemptyText(group.name)
  if (!rockGroupId || !name || group.isActive === false) return null

  const campus = relation(group.campus)
  return {
    rockGroupId,
    name,
    campusName: nonemptyText(campus?.name),
    campusSlug: nonemptyText(campus?.slug),
    locationName: nonemptyText(group.location?.name),
    locationAddress: nonemptyText(group.location?.address),
    isLeader: membership.isLeader === true,
    roleName: nonemptyText(membership.roleName) ?? 'Member',
  }
}

function toPortalProfile(profile: {
  personId: number
  name: string
  email: string
  photoUrl: string | null
}): MemberPortalProfile {
  return {
    personId: profile.personId,
    name: profile.name,
    email: profile.email,
    avatarUrl: profile.photoUrl ? '/member-avatar' : null,
  }
}

async function findCurrentParticipant(
  payload: MemberPayloadClient,
  rockPersonId: number,
): Promise<ParticipantRecord | null> {
  const result = await payload.find({
    collection: 'connect-group-participants',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    select: {
      rockPersonId: true,
      name: true,
      email: true,
      phoneNumbers: true,
      photoId: true,
      isCoach: true,
      memberships: true,
    },
    where: { rockPersonId: { equals: rockPersonId } },
  })
  const participant = result.docs[0]
  return participant ? participantFrom(participant) : null
}

function memberGroupIds(participant: ParticipantRecord | null) {
  return (participant?.memberships ?? [])
    .map((membership) => positiveInteger(membership.rockGroupId))
    .filter((id): id is number => id !== null)
}

async function findActiveGroupRecords(
  payload: MemberPayloadClient,
  participant: ParticipantRecord | null,
): Promise<ConnectGroupRecord[]> {
  const rockGroupIds = memberGroupIds(participant)
  if (rockGroupIds.length === 0) return []

  const result = await payload.find({
    collection: 'connect-groups',
    depth: 1,
    limit: 0,
    pagination: false,
    overrideAccess: true,
    select: {
      rockGroupId: true,
      name: true,
      slug: true,
      location: true,
      campus: true,
      isActive: true,
    },
    where: {
      and: [
        { rockGroupId: { in: rockGroupIds } },
        { isActive: { equals: true } },
      ],
    },
  })

  return result.docs.map(groupFrom)
}

async function findMemberGroups(
  payload: MemberPayloadClient,
  participant: ParticipantRecord | null,
): Promise<MemberGroupSummary[]> {
  const groups = await findActiveGroupRecords(payload, participant)
  return groups
    .map((group) => {
      const rockGroupId = positiveInteger(group.rockGroupId)
      const membership = rockGroupId
        ? membershipFor(participant ?? {}, rockGroupId)
        : null
      return membership ? toMemberGroup(group, membership) : null
    })
    .filter((group): group is MemberGroupSummary => group !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

function canAccessLeaderResources(participant: ParticipantRecord | null) {
  return participant?.isCoach === true || participant?.memberships?.some(
    (membership) => membership.isLeader === true,
  ) === true
}

const currentMemberContext = cache(async () => {
  const profile = await getCurrentMemberProfile({ persistLegacyProfile: true })
  if (!profile) return null
  const payload = (await getPayloadClient()) as unknown as MemberPayloadClient
  const participant = await findCurrentParticipant(payload, profile.personId)
  return { profile, payload, participant }
})

export async function getMemberPortalHome(): Promise<MemberPortalHome | null> {
  const context = await currentMemberContext()
  if (!context) return null
  const groups = await findMemberGroups(context.payload, context.participant)

  return {
    profile: toPortalProfile(context.profile),
    groups,
    canAccessLeaderResources: canAccessLeaderResources(context.participant),
  }
}

function toRosterPerson(
  participant: ParticipantRecord,
  membership: ParticipantMembershipRecord,
  currentRockPersonId: number,
): MemberRosterPerson | null {
  const rockPersonId = positiveInteger(participant.rockPersonId)
  const name = nonemptyText(participant.name)
  if (!rockPersonId || !name) return null

  return {
    rockPersonId,
    name,
    email: nonemptyText(participant.email),
    phones: (participant.phoneNumbers ?? [])
      .map((phone) => {
        const number = nonemptyText(phone.number)
        return number
          ? {
              number,
              typeValueId: positiveInteger(phone.typeValueId),
              isMessagingEnabled: phone.isMessagingEnabled === true,
            }
          : null
      })
      .filter((phone): phone is MemberRosterPerson['phones'][number] => phone !== null),
    avatarUrl: positiveInteger(participant.photoId)
      ? `/members/people/${rockPersonId}/avatar`
      : null,
    roleName: nonemptyText(membership.roleName) ?? 'Member',
    isLeader: membership.isLeader === true,
    isCurrentMember: rockPersonId === currentRockPersonId,
  }
}

export async function getMemberGroupDetail(
  rockGroupId: number,
): Promise<MemberGroupDetailResult | null> {
  if (!positiveInteger(rockGroupId)) return { access: 'denied' }
  const context = await currentMemberContext()
  if (!context) return null
  const currentMembership = context.participant
    ? membershipFor(context.participant, rockGroupId)
    : null
  if (!currentMembership) return { access: 'denied' }

  const [groupResult, peopleResult] = await Promise.all([
    context.payload.find({
      collection: 'connect-groups',
      depth: 1,
      limit: 1,
      pagination: false,
      overrideAccess: true,
      select: {
        rockGroupId: true,
        name: true,
        slug: true,
        location: true,
        campus: true,
        isActive: true,
      },
      where: {
        and: [
          { rockGroupId: { equals: rockGroupId } },
          { isActive: { equals: true } },
        ],
      },
    }),
    context.payload.find({
      collection: 'connect-group-participants',
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
      select: {
        rockPersonId: true,
        name: true,
        email: true,
        phoneNumbers: true,
        photoId: true,
        memberships: true,
      },
      where: { 'memberships.rockGroupId': { equals: rockGroupId } },
    }),
  ])
  const groupRecord = groupResult.docs[0]
  if (!groupRecord) return { access: 'denied' }
  const group = toMemberGroup(groupFrom(groupRecord), currentMembership)
  if (!group) return { access: 'denied' }

  const people = peopleResult.docs
    .map(participantFrom)
    .map((participant) => {
      const membership = membershipFor(participant, rockGroupId)
      return membership
        ? toRosterPerson(participant, membership, context.profile.personId)
        : null
    })
    .filter((person): person is MemberRosterPerson => person !== null)
    .sort((a, b) => {
      if (a.isLeader !== b.isLeader) return a.isLeader ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  return { access: 'granted', group, people }
}

function isApprovedResource(resource: ResourceRecord) {
  return resource.status === 1
}

function fileFrom(value: ResourceFileRecord | null | undefined) {
  const guid = nonemptyText(value?.guid)
  const name = nonemptyText(value?.name)
  return guid && name ? { guid: guid.toLowerCase(), name } : null
}

function toLeaderResource(resource: ResourceRecord): MemberLeaderResource | null {
  const rockId = positiveInteger(resource.rockId)
  const title = nonemptyText(resource.title)
  if (!rockId || !title || !isApprovedResource(resource)) return null

  return {
    rockId,
    title,
    startDateTime: nonemptyText(resource.startDateTime),
    expireDateTime: nonemptyText(resource.expireDateTime),
    description: nonemptyText(resource.description),
    youtubeUrl: nonemptyText(resource.youtubeUrl),
    promotionalImageUrl: nonemptyText(resource.promotionalImageGuid)
      ? `/members/connect-group-leader-resources/${rockId}/image`
      : null,
    hosts: (resource.hosts ?? [])
      .map((host, index) => {
        const name = nonemptyText(host.name)
        if (!name) return null
        return {
          name,
          avatarUrl: positiveInteger(host.photoId)
            ? `/members/connect-group-leader-resources/${rockId}/hosts/${index}/avatar`
            : null,
        }
      })
      .filter((host): host is MemberLeaderResource['hosts'][number] => host !== null),
    bibleReference: nonemptyText(resource.bibleReference),
    hasLeaderNotes: fileFrom(resource.leaderNotesFile) !== null,
    hasMemberStudy: fileFrom(resource.memberStudyFile) !== null,
    campusNames: (resource.campuses ?? [])
      .map((campus) => nonemptyText(relation(campus)?.name))
      .filter((name): name is string => name !== null),
    priority: resource.priority ?? 0,
    sourceOrder: resource.sourceOrder ?? 0,
  }
}

function resourceMatchesCampuses(
  resource: ResourceRecord,
  allowedCampusIds: Set<string>,
) {
  if ((resource.campusGuids ?? []).length === 0) return true
  return (resource.campuses ?? []).some((campus) => {
    const id = campusId(campus)
    return id ? allowedCampusIds.has(id) : false
  })
}

async function accessibleResourceRecords(
  payload: MemberPayloadClient,
  participant: ParticipantRecord,
) {
  if (!canAccessLeaderResources(participant)) return null
  const allowedCampusIds = participant.isCoach === true
    ? null
    : new Set(
        (await findActiveGroupRecords(payload, participant))
          .map((group) => campusId(group.campus))
          .filter((id): id is string => id !== null),
      )

  const resourceResult = await payload.find({
    collection: 'connect-group-leader-resources',
    depth: 1,
    limit: 0,
    pagination: false,
    overrideAccess: true,
    select: {
      rockId: true,
      title: true,
      status: true,
      startDateTime: true,
      expireDateTime: true,
      campusGuids: true,
      campuses: true,
      youtubeUrl: true,
      promotionalImageGuid: true,
      description: true,
      hosts: true,
      bibleReference: true,
      leaderNotesFile: true,
      memberStudyFile: true,
      priority: true,
      sourceOrder: true,
    },
    sort: ['-priority', 'sourceOrder', 'rockId'],
    where: { status: { equals: 1 } },
  })

  return resourceResult.docs
    .map(resourceFrom)
    .filter((resource) => (
      isApprovedResource(resource) &&
      (allowedCampusIds === null || resourceMatchesCampuses(resource, allowedCampusIds))
    ))
}

async function findAccessibleResourceRecord(
  payload: MemberPayloadClient,
  participant: ParticipantRecord,
  rockId: number,
) {
  if (!canAccessLeaderResources(participant)) return null
  const result = await payload.find({
    collection: 'connect-group-leader-resources',
    depth: 1,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    select: {
      rockId: true,
      title: true,
      status: true,
      startDateTime: true,
      expireDateTime: true,
      campusGuids: true,
      campuses: true,
      youtubeUrl: true,
      promotionalImageGuid: true,
      description: true,
      hosts: true,
      bibleReference: true,
      leaderNotesFile: true,
      memberStudyFile: true,
      priority: true,
      sourceOrder: true,
    },
    where: {
      and: [
        { rockId: { equals: rockId } },
        { status: { equals: 1 } },
      ],
    },
  })
  const resource = result.docs[0] ? resourceFrom(result.docs[0]) : null
  if (!resource || !isApprovedResource(resource)) return null
  if (participant.isCoach === true) return resource

  const allowedCampusIds = new Set(
    (await findActiveGroupRecords(payload, participant))
      .map((group) => campusId(group.campus))
      .filter((id): id is string => id !== null),
  )
  return resourceMatchesCampuses(resource, allowedCampusIds) ? resource : null
}

async function accessibleResources(
  payload: MemberPayloadClient,
  participant: ParticipantRecord,
) {
  const resources = await accessibleResourceRecords(payload, participant)
  if (!resources) return null
  return resources
    .map(toLeaderResource)
    .filter((resource): resource is MemberLeaderResource => resource !== null)
}

function timestamp(value: string | null): number | null {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function compareResources(a: MemberLeaderResource, b: MemberLeaderResource) {
  const priority = b.priority - a.priority
  if (priority !== 0) return priority
  const order = a.sourceOrder - b.sourceOrder
  if (order !== 0) return order
  return a.rockId - b.rockId
}

export async function getMemberResources(
  now = new Date(),
): Promise<MemberResourcesResult | null> {
  const context = await currentMemberContext()
  if (!context) return null
  if (!context.participant) return { access: 'denied' }
  const resources = await accessibleResources(context.payload, context.participant)
  if (!resources) return { access: 'denied' }

  const nowTime = now.getTime()
  const current: MemberLeaderResource[] = []
  const upcoming: MemberLeaderResource[] = []
  const history: MemberLeaderResource[] = []

  for (const resource of resources) {
    const startsAt = timestamp(resource.startDateTime)
    const expiresAt = timestamp(resource.expireDateTime)
    if (startsAt !== null && startsAt > nowTime) {
      upcoming.push(resource)
    } else if (expiresAt === null || expiresAt > nowTime) {
      current.push(resource)
    } else {
      history.push(resource)
    }
  }

  current.sort(compareResources)
  upcoming.sort((a, b) => (
    (timestamp(a.startDateTime) ?? Number.MAX_SAFE_INTEGER) -
    (timestamp(b.startDateTime) ?? Number.MAX_SAFE_INTEGER)
  ))
  history.sort((a, b) => (
    (timestamp(b.startDateTime) ?? 0) - (timestamp(a.startDateTime) ?? 0)
  ))

  return { access: 'granted', current, upcoming, history }
}

export async function getMemberResourceDetail(
  rockId: number,
): Promise<MemberResourceDetailResult | null> {
  if (!positiveInteger(rockId)) return { access: 'denied' }
  const context = await currentMemberContext()
  if (!context) return null
  if (!context.participant) return { access: 'denied' }
  const record = await findAccessibleResourceRecord(
    context.payload,
    context.participant,
    rockId,
  )
  const resource = record ? toLeaderResource(record) : null
  return resource
    ? { access: 'granted', resource }
    : { access: 'denied' }
}

export async function getMemberResourceAsset(
  rockId: number,
  request: MemberResourceAssetRequest,
): Promise<MemberResourceAsset | null> {
  if (!positiveInteger(rockId)) return null
  const context = await currentMemberContext()
  if (!context?.participant) return null
  const resource = await findAccessibleResourceRecord(
    context.payload,
    context.participant,
    rockId,
  )
  if (!resource) return null

  if (request.kind === 'image') {
    const guid = nonemptyText(resource.promotionalImageGuid)
    return guid
      ? { kind: 'image', guid }
      : null
  }

  if (request.kind === 'host-avatar') {
    const photoId = positiveInteger(resource.hosts?.[request.index]?.photoId)
    return photoId
      ? { kind: 'avatar', photoId }
      : null
  }

  const file = request.kind === 'leader-notes'
    ? resource.leaderNotesFile
    : resource.memberStudyFile
  const normalized = fileFrom(file)
  return normalized
    ? { kind: 'file', guid: normalized.guid, name: normalized.name }
    : null
}

export async function getSharedMemberAvatar(
  targetRockPersonId: number,
): Promise<{ photoId: number } | null> {
  if (!positiveInteger(targetRockPersonId)) return null
  const context = await currentMemberContext()
  if (!context?.participant) return null
  const currentGroupIds = new Set(
    (context.participant.memberships ?? [])
      .map((membership) => positiveInteger(membership.rockGroupId))
      .filter((id): id is number => id !== null),
  )
  if (currentGroupIds.size === 0) return null

  const result = await context.payload.find({
    collection: 'connect-group-participants',
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    select: {
      photoId: true,
      memberships: true,
    },
    where: { rockPersonId: { equals: targetRockPersonId } },
  })
  const target = result.docs[0] ? participantFrom(result.docs[0]) : null
  if (!target) return null
  const sharesGroup = target.memberships?.some((membership) => {
    const id = positiveInteger(membership.rockGroupId)
    return id ? currentGroupIds.has(id) : false
  }) === true
  const photoId = positiveInteger(target.photoId)
  return sharesGroup && photoId ? { photoId } : null
}
