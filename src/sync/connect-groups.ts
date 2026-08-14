import type { PayloadRequest } from 'payload'

import {
  rockFetchAll,
  type RockGroup,
  type RockGroupMember,
  type RockPerson,
} from '@/lib/rock-api'
import { getPayloadClient } from '@/lib/payload'

import { mapRockConnectGroup } from './mappers/connect-group'
import { mapRockConnectGroupParticipant } from './mappers/connect-group-participant'
import { fetchActiveGroupMembers } from './rock-group-members'
import type { SyncResult } from './sync-runner'

export const CONNECT_GROUP_TYPE_IDS = [25, 46] as const
export const CONNECT_GROUP_COACH_SECURITY_GROUP_ID = 33287

const MIN_EXISTING_RECORDS_FOR_DROP_GUARD = 10
const MIN_ACCEPTABLE_SNAPSHOT_RATIO = 0.5

type RockConnectGroup = Omit<RockGroup, 'Members'>

type PreparedRecord = {
  rockId: number
  data: Record<string, unknown>
}

type ReconciledCollection = 'connect-groups' | 'connect-group-participants'

type ReconciliationPayload = {
  create(options: {
    collection: ReconciledCollection
    data: Record<string, unknown>
    req: PayloadRequest
  }): Promise<unknown>
  delete(options: {
    collection: ReconciledCollection
    id: number | string
    req: PayloadRequest
  }): Promise<unknown>
  find(options: {
    collection: ReconciledCollection
    depth: 0
    limit: number
    pagination: false
    req: PayloadRequest
    select: Record<string, true>
  }): Promise<{
    docs: Array<{
      id: number | string
      rockGroupId?: number
      rockPersonId?: number
    }>
  }>
  update(options: {
    collection: ReconciledCollection
    id: number | string
    data: Record<string, unknown>
    req: PayloadRequest
  }): Promise<unknown>
}

function requireDurableId(value: number | undefined, label: string): number {
  if (!Number.isInteger(value) || (value ?? 0) <= 0) {
    throw new Error(`${label} is missing a durable Id`)
  }
  return value as number
}

function validateMembership(membership: RockGroupMember, expectedGroupId: number): void {
  requireDurableId(membership.Id, 'Rock group membership')
  const groupId = requireDurableId(membership.GroupId, 'Rock group membership group')
  requireDurableId(membership.Person?.Id, 'Rock group membership person')
  requireDurableId(membership.GroupRoleId, 'Rock group membership role')

  if (groupId !== expectedGroupId) {
    throw new Error(
      `Rock group membership ${membership.Id} belongs to group ${groupId}, expected ${expectedGroupId}`,
    )
  }
}

function assertSnapshotSafe(
  label: string,
  preparedCount: number,
  existingCount: number,
): void {
  if (preparedCount === 0 && existingCount > 0) {
    throw new Error(`Rock returned an empty ${label} snapshot while mirrored records still exist`)
  }
  if (
    existingCount >= MIN_EXISTING_RECORDS_FOR_DROP_GUARD &&
    preparedCount / existingCount <= MIN_ACCEPTABLE_SNAPSHOT_RATIO
  ) {
    throw new Error(
      `Rock returned an implausible ${label} snapshot drop (${existingCount} to ${preparedCount} records)`,
    )
  }
}

function buildParticipantSnapshot(
  membershipsByGroup: Array<{ groupId: number; memberships: RockGroupMember[] }>,
  coachMemberships: RockGroupMember[],
  syncedAt: string,
): PreparedRecord[] {
  const membershipsByPersonId = new Map<number, RockGroupMember[]>()
  const peopleById = new Map<number, RockPerson>()

  for (const { groupId, memberships } of membershipsByGroup) {
    for (const membership of memberships) {
      validateMembership(membership, groupId)
      const personId = membership.Person.Id
      peopleById.set(personId, membership.Person)
      const personMemberships = membershipsByPersonId.get(personId) ?? []
      personMemberships.push(membership)
      membershipsByPersonId.set(personId, personMemberships)
    }
  }

  const coachPersonIds = new Set<number>()
  for (const membership of coachMemberships) {
    validateMembership(membership, CONNECT_GROUP_COACH_SECURITY_GROUP_ID)
    const personId = membership.Person.Id
    coachPersonIds.add(personId)
    if (!peopleById.has(personId)) peopleById.set(personId, membership.Person)
  }

  return [...peopleById.entries()]
    .sort(([left], [right]) => left - right)
    .map(([personId, person]) => ({
      rockId: personId,
      data: {
        ...mapRockConnectGroupParticipant(
          person,
          membershipsByPersonId.get(personId) ?? [],
          coachPersonIds.has(personId),
        ),
        lastSyncedAt: syncedAt,
      },
    }))
}

async function reconcileCollection({
  payload,
  collection,
  key,
  prepared,
  existing,
  req,
}: {
  payload: ReconciliationPayload
  collection: ReconciledCollection
  key: 'rockGroupId' | 'rockPersonId'
  prepared: PreparedRecord[]
  existing: Array<{ id: number | string; rockGroupId?: number; rockPersonId?: number }>
  req: PayloadRequest
}): Promise<{ created: number; updated: number; deleted: number }> {
  const existingByRockId = new Map(
    existing.map((record) => [record[key] as number, record.id]),
  )
  let created = 0
  let updated = 0
  let deleted = 0

  for (const record of prepared) {
    const existingId = existingByRockId.get(record.rockId)
    if (existingId !== undefined) {
      await payload.update({ collection, id: existingId, data: record.data, req })
      updated++
    } else {
      await payload.create({ collection, data: record.data, req })
      created++
    }
  }

  const remoteIds = new Set(prepared.map((record) => record.rockId))
  for (const record of existing) {
    const rockId = record[key]
    if (rockId !== undefined && remoteIds.has(rockId)) continue
    await payload.delete({ collection, id: record.id, req })
    deleted++
  }

  return { created, updated, deleted }
}

/** Atomically reconciles public Connect Groups and their private participant mirror. */
export async function syncConnectGroups(): Promise<SyncResult> {
  const result: SyncResult = {
    entity: 'connect-groups',
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  }

  try {
    const groups = await rockFetchAll<RockConnectGroup>({
      endpoint: 'Groups',
      getKey: (group) => requireDurableId(group.Id, 'Rock Connect Group'),
      params: {
        $filter: `(${CONNECT_GROUP_TYPE_IDS.map((id) => `GroupTypeId eq ${id}`).join(' or ')}) and IsActive eq true`,
        $expand: 'GroupLocations,Campus',
        $orderby: 'Name,Id',
      },
    })
    const memberSnapshots: Array<{ groupId: number; memberships: RockGroupMember[] }> = []
    for (const group of groups) {
      memberSnapshots.push({
        groupId: group.Id,
        memberships: await fetchActiveGroupMembers(group.Id),
      })
    }
    const coachMemberships = await fetchActiveGroupMembers(
      CONNECT_GROUP_COACH_SECURITY_GROUP_ID,
    )

    const syncedAt = new Date().toISOString()
    const preparedParticipants = buildParticipantSnapshot(
      memberSnapshots,
      coachMemberships,
      syncedAt,
    )

    const payload = await getPayloadClient()
    const mirroredCampuses = await payload.find({
      collection: 'campuses',
      depth: 0,
      limit: 1000,
      pagination: false,
      select: { rockId: true },
    })
    const campusPayloadIdByRockId = new Map(
      mirroredCampuses.docs.map((campus) => [campus.rockId, campus.id]),
    )

    const preparedGroups: PreparedRecord[] = groups.map((group, index) => {
      const members = memberSnapshots[index].memberships
      const mapped = mapRockConnectGroup({ ...group, Members: members })
      const { _campusRockId, ...publicGroup } = mapped
      const campus =
        _campusRockId === null ? null : campusPayloadIdByRockId.get(_campusRockId)
      if (_campusRockId !== null && campus === undefined) {
        throw new Error(
          `Rock Connect Group ${group.Id} references unresolved campus ${_campusRockId}`,
        )
      }
      return {
        rockId: mapped.rockGroupId,
        data: {
          ...publicGroup,
          campus,
          lastSyncedAt: syncedAt,
        },
      }
    })

    const transactionID = await payload.db.beginTransaction()
    if (transactionID === null || transactionID === undefined) {
      throw new Error('Payload database transactions are required for Connect Group reconciliation')
    }
    const req = { transactionID } as PayloadRequest
    const reconciliationPayload = payload as unknown as ReconciliationPayload

    try {
      const [existingGroups, existingParticipants] = await Promise.all([
        reconciliationPayload.find({
          collection: 'connect-groups',
          depth: 0,
          limit: 0,
          pagination: false,
          select: { rockGroupId: true },
          req,
        }),
        reconciliationPayload.find({
          collection: 'connect-group-participants',
          depth: 0,
          limit: 0,
          pagination: false,
          select: { rockPersonId: true },
          req,
        }),
      ])

      assertSnapshotSafe('Connect Group', preparedGroups.length, existingGroups.docs.length)
      assertSnapshotSafe(
        'Connect Group participant',
        preparedParticipants.length,
        existingParticipants.docs.length,
      )

      const groupChanges = await reconcileCollection({
        payload: reconciliationPayload,
        collection: 'connect-groups',
        key: 'rockGroupId',
        prepared: preparedGroups,
        existing: existingGroups.docs,
        req,
      })
      const participantChanges = await reconcileCollection({
        payload: reconciliationPayload,
        collection: 'connect-group-participants',
        key: 'rockPersonId',
        prepared: preparedParticipants,
        existing: existingParticipants.docs,
        req,
      })

      await payload.db.commitTransaction(transactionID)
      result.created = groupChanges.created + participantChanges.created
      result.updated = groupChanges.updated + participantChanges.updated
      result.deleted = groupChanges.deleted + participantChanges.deleted
    } catch (error) {
      await payload.db.rollbackTransaction(transactionID)
      throw error
    }
  } catch (error) {
    result.errors.push(String(error))
  }

  return result
}
