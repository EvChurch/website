import type { PayloadRequest } from 'payload'

import {
  classifyLauncherHref,
  launcherPlainText,
  sanitizeLauncherHtml,
} from '@/lib/launcher/sanitize'
import { listEligibleRockConnectionSignups } from '@/lib/rock-connection-signups/server'
import {
  rockFetchAll,
  type RockCampus,
  type RockContentChannelItem,
  type RockEventItem,
} from '@/lib/rock-api'
import { getPayloadClient } from '@/lib/payload'

import { mapRockServiceGuideItem } from './mappers/service-guide-item'
import type { SyncResult } from './sync-runner'

export const SERVICE_GUIDE_CONTENT_CHANNEL_ID = 13
const MIN_EXISTING_ITEMS_FOR_DROP_GUARD = 10
const MIN_ACCEPTABLE_SNAPSHOT_RATIO = 0.5

function normalizedGuid(value: string | undefined): string | null {
  return value?.trim().toLowerCase() || null
}

/**
 * Reconciles a complete Rock Service Guide snapshot in one database transaction.
 * Remote reads and reference resolution finish before the transaction begins, so
 * a partial Rock response can never trigger destructive cleanup.
 */
export async function syncServiceGuideItems(): Promise<SyncResult> {
  const result: SyncResult = {
    entity: 'service-guide-items',
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  }

  try {
    const rockItems = await rockFetchAll<RockContentChannelItem>({
      endpoint: 'ContentChannelItems',
      getKey: (item) => item.Id,
      params: {
        $filter: `ContentChannelId eq ${SERVICE_GUIDE_CONTENT_CHANNEL_ID}`,
        $orderby: 'Priority desc,Order,Id',
        loadAttributes: 'simple',
      },
    })

    // All required remote reference reads must succeed before Payload is mutated.
    const [rockCampuses, rockEvents, eligibleConnections] = await Promise.all([
      rockFetchAll<RockCampus>({
        endpoint: 'Campuses',
        getKey: (campus) => campus.Id,
        params: { $orderby: 'Id', $select: 'Id,Guid' },
      }),
      rockFetchAll<RockEventItem>({
        endpoint: 'EventItems',
        getKey: (event) => event.Id,
        params: { $orderby: 'Id', $select: 'Id,Guid' },
      }),
      listEligibleRockConnectionSignups(),
    ])

    const payload = await getPayloadClient()
    const [payloadCampuses, payloadEvents] = await Promise.all([
      payload.find({
        collection: 'campuses',
        depth: 0,
        limit: 1000,
        pagination: false,
        select: { rockId: true },
      }),
      payload.find({
        collection: 'events',
        depth: 0,
        limit: 1000,
        pagination: false,
        select: { rockEventId: true },
      }),
    ])

    const campusPayloadIdByRockId = new Map(
      payloadCampuses.docs.map((campus) => [campus.rockId, campus.id]),
    )
    const campusPayloadIdByGuid = new Map<string, number>()
    for (const campus of rockCampuses) {
      const guid = normalizedGuid(campus.Guid)
      const payloadId = campusPayloadIdByRockId.get(campus.Id)
      if (guid && payloadId !== undefined) campusPayloadIdByGuid.set(guid, payloadId)
    }

    const eventPayloadIdByRockId = new Map(
      payloadEvents.docs.map((event) => [event.rockEventId, event.id]),
    )
    const eventPayloadIdByGuid = new Map<string, number>()
    for (const event of rockEvents) {
      const guid = normalizedGuid(event.Guid)
      const payloadId = eventPayloadIdByRockId.get(event.Id)
      if (guid && payloadId !== undefined) eventPayloadIdByGuid.set(guid, payloadId)
    }

    // Options are already deterministic; first eligible block wins for an opportunity.
    const blockGuidByOpportunityGuid = new Map<string, string>()
    for (const option of eligibleConnections) {
      const opportunityGuid = normalizedGuid(option.opportunityGuid)
      if (opportunityGuid && !blockGuidByOpportunityGuid.has(opportunityGuid)) {
        blockGuidByOpportunityGuid.set(opportunityGuid, option.blockGuid)
      }
    }

    let diagnosticCount = 0
    const syncedAt = new Date().toISOString()
    const prepared = rockItems.map((rockItem) => {
      const mapped = mapRockServiceGuideItem(rockItem)
      const campuses = mapped.campusGuids
        .map((guid) => campusPayloadIdByGuid.get(guid))
        .filter((id): id is number => id !== undefined)
      if (campuses.length !== mapped.campusGuids.length) diagnosticCount++

      const event = mapped.eventGuid ? eventPayloadIdByGuid.get(mapped.eventGuid) : undefined
      if (mapped.eventGuid && event === undefined) diagnosticCount++

      const connectionBlockGuid = mapped.connectionOpportunityGuid
        ? blockGuidByOpportunityGuid.get(mapped.connectionOpportunityGuid)
        : undefined
      if (mapped.connectionOpportunityGuid && connectionBlockGuid === undefined) diagnosticCount++

      const hasUsableAction = Boolean(
        (mapped.directLink && classifyLauncherHref(mapped.directLink)) ||
          connectionBlockGuid ||
          mapped.workflowGuid ||
          event ||
          launcherPlainText(sanitizeLauncherHtml(mapped.content ?? '')),
      )
      if (!hasUsableAction) diagnosticCount++

      return {
        rockId: mapped.rockId,
        data: {
          ...mapped,
          campusGuids: mapped.campusGuids.map((guid) => ({ guid })),
          campuses,
          connectionBlockGuid: connectionBlockGuid ?? null,
          event: event ?? null,
          lastSyncedAt: syncedAt,
        },
      }
    })

    const transactionID = await payload.db.beginTransaction()
    if (transactionID === null || transactionID === undefined) {
      throw new Error('Payload database transactions are required for Service Guide reconciliation')
    }
    const req = { transactionID } as PayloadRequest

    let created = 0
    let updated = 0
    let deleted = 0
    try {
      const existing = await payload.find({
        collection: 'service-guide-items',
        depth: 0,
        limit: 1000,
        pagination: false,
        select: { rockId: true },
        req,
      })
      if (prepared.length === 0 && existing.docs.length > 0) {
        throw new Error(
          'Rock returned an empty Service Guide snapshot while mirrored records still exist',
        )
      }
      if (
        existing.docs.length >= MIN_EXISTING_ITEMS_FOR_DROP_GUARD &&
        prepared.length / existing.docs.length < MIN_ACCEPTABLE_SNAPSHOT_RATIO
      ) {
        throw new Error(
          `Rock returned an implausible Service Guide snapshot drop (${existing.docs.length} to ${prepared.length} items)`,
        )
      }
      const existingByRockId = new Map(existing.docs.map((item) => [item.rockId, item.id]))

      for (const item of prepared) {
        const existingId = existingByRockId.get(item.rockId)
        if (existingId !== undefined) {
          await payload.update({
            collection: 'service-guide-items',
            id: existingId,
            data: item.data,
            req,
          })
          updated++
        } else {
          await payload.create({
            collection: 'service-guide-items',
            data: item.data,
            req,
          })
          created++
        }
      }

      const fetchedRockIds = new Set(prepared.map((item) => item.rockId))
      for (const existingItem of existing.docs) {
        if (fetchedRockIds.has(existingItem.rockId)) continue
        await payload.delete({
          collection: 'service-guide-items',
          id: existingItem.id,
          req,
        })
        deleted++
      }

      await payload.updateGlobal({
        slug: 'service-guide-sync-state',
        data: {
          lastSuccessfulSyncAt: syncedAt,
          itemCount: prepared.length,
          diagnosticCount,
        },
        req,
      })
      await payload.db.commitTransaction(transactionID)
    } catch (error) {
      await payload.db.rollbackTransaction(transactionID)
      throw error
    }

    result.created = created
    result.updated = updated
    result.deleted = deleted
  } catch (error) {
    result.errors.push(String(error))
  }

  return result
}
