import type { PayloadRequest } from 'payload'

import {
  rockFetchAll,
  type RockCampus,
  type RockContentChannelItem,
  type RockPersonAlias,
} from '@/lib/rock-api'
import { getPayloadClient } from '@/lib/payload'

import {
  mapRockConnectGroupLeaderResource,
  type MappedConnectGroupLeaderResource,
} from './mappers/connect-group-leader-resource'
import type { SyncResult } from './sync-runner'

export const CONNECT_GROUP_LEADER_RESOURCES_CONTENT_CHANNEL_ID = 24

const MIN_EXISTING_RECORDS_FOR_DROP_GUARD = 10
const MIN_ACCEPTABLE_SNAPSHOT_RATIO = 0.5
const HOST_LOOKUP_CONCURRENCY = 4

type PreparedResource = {
  rockId: number
  data: Record<string, unknown>
}

type ResourcePayload = {
  create(options: {
    collection: 'connect-group-leader-resources'
    data: Record<string, unknown>
    req: PayloadRequest
  }): Promise<unknown>
  delete(options: {
    collection: 'connect-group-leader-resources'
    id: number | string
    req: PayloadRequest
  }): Promise<unknown>
  find(options: {
    collection: 'connect-group-leader-resources'
    depth: 0
    limit: number
    pagination: false
    req: PayloadRequest
    select: { rockId: true }
  }): Promise<{ docs: Array<{ id: number | string; rockId: number }> }>
  update(options: {
    collection: 'connect-group-leader-resources'
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

function normalizedGuid(value: string | undefined): string | null {
  return value?.trim().toLowerCase() || null
}

function assertSnapshotSafe(preparedCount: number, existingCount: number): void {
  if (preparedCount === 0 && existingCount > 0) {
    throw new Error(
      'Rock returned an empty Connect Group Leader Resource snapshot while mirrored records still exist',
    )
  }
  if (
    existingCount >= MIN_EXISTING_RECORDS_FOR_DROP_GUARD &&
    preparedCount / existingCount <= MIN_ACCEPTABLE_SNAPSHOT_RATIO
  ) {
    throw new Error(
      `Rock returned an implausible Connect Group Leader Resource snapshot drop (${existingCount} to ${preparedCount} records)`,
    )
  }
}

async function fetchHostPhotoIds(
  resources: MappedConnectGroupLeaderResource[],
): Promise<Map<string, number | null>> {
  const hostGuids = [
    ...new Set(
      resources.flatMap((resource) =>
        resource.hosts.flatMap((host) =>
          host.personAliasGuid ? [host.personAliasGuid] : [],
        ),
      ),
    ),
  ]
  const photoIdByAliasGuid = new Map<string, number | null>()

  // Keep exact lookups while bounding concurrent Rock requests.
  for (let index = 0; index < hostGuids.length; index += HOST_LOOKUP_CONCURRENCY) {
    const batch = hostGuids.slice(index, index + HOST_LOOKUP_CONCURRENCY)
    const aliasesByGuid = await Promise.all(batch.map(async (hostGuid) => ({
      hostGuid,
      aliases: await rockFetchAll<RockPersonAlias>({
        endpoint: 'PersonAlias',
        getKey: (alias) => requireDurableId(alias.Id, 'Rock PersonAlias'),
        params: {
          $expand: 'Person',
          $filter: `Guid eq guid'${hostGuid}'`,
          $orderby: 'Id',
        },
      }),
    })))
    for (const { hostGuid, aliases } of aliasesByGuid) {
      if (aliases.length > 1) {
        throw new Error(`Rock returned duplicate PersonAliases for host ${hostGuid}`)
      }
      photoIdByAliasGuid.set(hostGuid, aliases[0]?.Person?.PhotoId ?? null)
    }
  }

  return photoIdByAliasGuid
}

/** Atomically reconciles the complete private Rock Content Channel 24 mirror. */
export async function syncConnectGroupLeaderResources(): Promise<SyncResult> {
  const result: SyncResult = {
    entity: 'connect-group-leader-resources',
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  }

  try {
    const rockItems = await rockFetchAll<RockContentChannelItem>({
      endpoint: 'ContentChannelItems',
      getKey: (item) => requireDurableId(item.Id, 'Rock Content Channel item'),
      params: {
        $filter: `ContentChannelId eq ${CONNECT_GROUP_LEADER_RESOURCES_CONTENT_CHANNEL_ID}`,
        $orderby: 'Priority desc,Order,Id',
        loadAttributes: 'simple',
      },
    })
    const mappedResources = rockItems.map(mapRockConnectGroupLeaderResource)

    // Complete all Rock reads before acquiring a Payload client or starting writes.
    const [rockCampuses, photoIdByAliasGuid] = await Promise.all([
      rockFetchAll<RockCampus>({
        endpoint: 'Campuses',
        getKey: (campus) => requireDurableId(campus.Id, 'Rock campus'),
        params: { $orderby: 'Id', $select: 'Id,Guid' },
      }),
      fetchHostPhotoIds(mappedResources),
    ])

    const payload = await getPayloadClient()
    const payloadCampuses = await payload.find({
      collection: 'campuses',
      depth: 0,
      limit: 1000,
      pagination: false,
      select: { rockId: true },
    })
    const payloadCampusIdByRockId = new Map(
      payloadCampuses.docs.map((campus) => [campus.rockId, campus.id]),
    )
    const payloadCampusIdByGuid = new Map<string, number | string>()
    for (const rockCampus of rockCampuses) {
      const guid = normalizedGuid(rockCampus.Guid)
      const payloadId = payloadCampusIdByRockId.get(rockCampus.Id)
      if (guid && payloadId !== undefined) payloadCampusIdByGuid.set(guid, payloadId)
    }

    const syncedAt = new Date().toISOString()
    const prepared: PreparedResource[] = mappedResources.map((mapped) => {
      const campuses = mapped.campusGuids.map((guid) => {
        const payloadCampusId = payloadCampusIdByGuid.get(guid)
        if (payloadCampusId === undefined) {
          throw new Error(
            `Rock Connect Group Leader Resource ${mapped.rockId} references unresolved campus ${guid}`,
          )
        }
        return payloadCampusId
      })

      return {
        rockId: mapped.rockId,
        data: {
          ...mapped,
          campusGuids: mapped.campusGuids.map((guid) => ({ guid })),
          campuses,
          hosts: mapped.hosts.map((host) => ({
            ...host,
            photoId: host.personAliasGuid
              ? (photoIdByAliasGuid.get(host.personAliasGuid) ?? null)
              : null,
          })),
          lastSyncedAt: syncedAt,
        },
      }
    })

    const transactionID = await payload.db.beginTransaction()
    if (transactionID === null || transactionID === undefined) {
      throw new Error(
        'Payload database transactions are required for Connect Group Leader Resource reconciliation',
      )
    }
    const req = { transactionID } as PayloadRequest
    const reconciliationPayload = payload as unknown as ResourcePayload

    let created = 0
    let updated = 0
    let deleted = 0
    try {
      const existing = await reconciliationPayload.find({
        collection: 'connect-group-leader-resources',
        depth: 0,
        limit: 0,
        pagination: false,
        select: { rockId: true },
        req,
      })
      assertSnapshotSafe(prepared.length, existing.docs.length)
      const existingByRockId = new Map(existing.docs.map((record) => [record.rockId, record.id]))

      for (const resource of prepared) {
        const existingId = existingByRockId.get(resource.rockId)
        if (existingId === undefined) {
          await reconciliationPayload.create({
            collection: 'connect-group-leader-resources',
            data: resource.data,
            req,
          })
          created++
        } else {
          await reconciliationPayload.update({
            collection: 'connect-group-leader-resources',
            id: existingId,
            data: resource.data,
            req,
          })
          updated++
        }
      }

      const remoteRockIds = new Set(prepared.map((resource) => resource.rockId))
      for (const existingResource of existing.docs) {
        if (remoteRockIds.has(existingResource.rockId)) continue
        await reconciliationPayload.delete({
          collection: 'connect-group-leader-resources',
          id: existingResource.id,
          req,
        })
        deleted++
      }

      await payload.db.commitTransaction(transactionID)
      result.created = created
      result.updated = updated
      result.deleted = deleted
    } catch (error) {
      await payload.db.rollbackTransaction(transactionID)
      throw error
    }
  } catch (error) {
    result.errors.push(String(error))
  }

  return result
}
