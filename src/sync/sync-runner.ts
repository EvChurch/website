import { getPayloadClient } from '@/lib/payload'
import { rockFetch } from '@/lib/rock-api'
import { convertHTMLToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { JSDOM } from 'jsdom'
import type {
  RockCampus,
  RockEventCalendar,
  RockEventCalendarItem,
  RockEventItem,
  RockEventItemOccurrence,
  RockLocation,
  RockPersonAlias,
} from '@/lib/rock-api'
import { mapRockCampus } from './mappers/campus'
import { mapRockTeamMember, TEAM_GROUP_IDS } from './mappers/team-member'
import {
  getEventItemIdsWithUpcomingOccurrences,
  getEventItemIdsForCalendar,
  mapRockEvent,
  selectNextEventOccurrences,
} from './mappers/event'
import { syncRockImage } from './rock-media'
import { runSermonSync } from './sermon-sync-runner'
import { fetchActiveGroupMembers } from './rock-group-members'
import { syncServiceGuideItems } from './service-guide-items'
import { syncConnectGroups } from './connect-groups'
import { syncConnectGroupLeaderResources } from './connect-group-leader-resources'
import { syncDailyBibleReadings } from './daily-bible-readings'

export { syncConnectGroups } from './connect-groups'

export type SyncResult = {
  entity: string
  created: number
  updated: number
  deleted: number
  errors: string[]
  warnings?: string[]
}

/**
 * Full reconciliation sync for all Rock RMS entity types.
 * Designed to run on a 15-minute cron schedule.
 */
export async function runFullSync(options?: { sermonLimit?: number }): Promise<SyncResult[]> {
  const results: SyncResult[] = []

  results.push(await syncCampuses())
  results.push(await syncTeamMembers())
  results.push(await syncEvents())
  results.push(await syncServiceGuideItems())
  results.push(await syncConnectGroups())
  results.push(await syncConnectGroupLeaderResources())
  results.push(await syncDailyBibleReadings())

  // Sermon data from resources.ev.church GraphQL API
  const sermonResults = await runSermonSync(options?.sermonLimit)
  results.push(...sermonResults)

  return results
}

export async function syncCampuses(): Promise<SyncResult> {
  const result: SyncResult = { entity: 'campuses', created: 0, updated: 0, deleted: 0, errors: [] }

  try {
    const payload = await getPayloadClient()
    const rockCampuses = await rockFetch<RockCampus[]>({
      endpoint: 'Campuses',
      params: {
        $filter: 'IsActive eq true and CampusTypeValueId eq 768',
        $orderby: 'Order',
      },
    })

    for (const rockCampus of rockCampuses) {
      const location = rockCampus.LocationId
        ? await rockFetch<RockLocation>({
            endpoint: `Locations/${rockCampus.LocationId}`,
            params: { loadAttributes: 'simple' },
          })
        : rockCampus.Location
      const mapped = mapRockCampus({ ...rockCampus, Location: location })
      const existing = await payload.find({
        collection: 'campuses',
        where: { rockId: { equals: mapped.rockId } },
        depth: 0,
        limit: 1,
      })

      if (existing.docs.length > 0) {
        await payload.update({
          collection: 'campuses',
          id: existing.docs[0].id,
          data: mapped,
        })
        result.updated++
      } else {
        await payload.create({
          collection: 'campuses',
          data: mapped,
        })
        result.created++
      }
    }

  } catch (error) {
    result.errors.push(String(error))
  }

  return result
}

export async function syncTeamMembers(): Promise<SyncResult> {
  const result: SyncResult = { entity: 'team-members', created: 0, updated: 0, deleted: 0, errors: [] }

  try {
    const payload = await getPayloadClient()

    for (const groupId of TEAM_GROUP_IDS) {
      try {
        const members = await fetchActiveGroupMembers(groupId)

        for (const member of members) {
          const mapped = mapRockTeamMember(member, groupId)
          if (!mapped) continue
          const existing = await payload.find({
            collection: 'team-members',
            where: { rockPersonId: { equals: mapped.rockPersonId } },
            depth: 0,
            limit: 1,
          })

          if (existing.docs.length > 0) {
            await payload.update({
              collection: 'team-members',
              id: existing.docs[0].id,
              data: mapped,
            })
            result.updated++
          } else {
            await payload.create({
              collection: 'team-members',
              data: mapped,
            })
            result.created++
          }
        }
      } catch (error) {
        result.errors.push(`Rock group ${groupId} sync failed: ${String(error)}`)
      }
    }

  } catch (error) {
    result.errors.push(String(error))
  }

  return result
}

async function syncEvents(): Promise<SyncResult> {
  const result: SyncResult = { entity: 'events', created: 0, updated: 0, deleted: 0, errors: [] }

  try {
    const payload = await getPayloadClient()
    const eventEditorConfig = await editorConfigFactory.default({ config: payload.config })
    const occurrences = await rockFetch<RockEventItemOccurrence[]>({
      endpoint: 'EventItemOccurrences',
      params: {
        $expand: 'Schedule,Campus,ContactPersonAlias/Person',
        $orderby: 'NextStartDateTime',
      },
    })
    const eventItems = await rockFetch<RockEventItem[]>({
      endpoint: 'EventItems',
      params: {
        $filter: 'IsActive eq true',
        $expand: 'Photo',
      },
    })
    const eventCalendars = await rockFetch<RockEventCalendar[]>({
      endpoint: 'EventCalendars',
      params: {
        $filter: 'IsActive eq true',
      },
    })
    const eventCalendarItems = await rockFetch<RockEventCalendarItem[]>({
      endpoint: 'EventCalendarItems',
    })
    const publicEventItemIds = getEventItemIdsForCalendar(
      eventCalendars,
      eventCalendarItems,
      'Website (Public)',
    )
    const syncedEventItemIds = getEventItemIdsWithUpcomingOccurrences(
      occurrences,
      eventItems,
      publicEventItemIds,
    )
    const eventItemsById = new Map(eventItems.map((eventItem) => [eventItem.Id, eventItem]))
    for (const occ of selectNextEventOccurrences(occurrences)) {
      const eventItem = eventItemsById.get(occ.EventItemId)
      if (!eventItem || !publicEventItemIds.has(eventItem.Id)) continue

      const resolvedContactPerson = occ.ContactPersonAlias?.Person ?? (
        occ.ContactPersonAliasId
          ? (await rockFetch<RockPersonAlias>({
              endpoint: `PersonAlias/${occ.ContactPersonAliasId}`,
              params: { $expand: 'Person' },
            })).Person
          : null
      )
      const mapped = mapRockEvent(occ, eventItem, resolvedContactPerson)
      const {
        _campusRockId,
        _descriptionHtml,
        _imageUrl,
        ...eventData
      } = mapped
      const existing = await payload.find({
        collection: 'events',
        where: { rockEventId: { equals: eventData.rockEventId } },
        depth: 0,
        limit: 1,
      })

      let campus: number | undefined
      if (_campusRockId !== null) {
        const matchingCampus = await payload.find({
          collection: 'campuses',
          where: { rockId: { equals: _campusRockId } },
          depth: 0,
          limit: 1,
        })
        campus = matchingCampus.docs[0]?.id
      }

      const image = _imageUrl
        ? await syncRockImage({ payload, photoUrl: _imageUrl, alt: `${eventData.title} event` })
        : null
      const data = {
        ...eventData,
        summary: _descriptionHtml
          ? convertHTMLToLexical({
              editorConfig: eventEditorConfig,
              html: _descriptionHtml,
              JSDOM,
            })
          : null,
        ...(campus !== undefined ? { campus } : {}),
        ...(image !== null ? { image } : {}),
      }

      if (existing.docs.length > 0) {
        await payload.update({
          collection: 'events',
          id: existing.docs[0].id,
          data,
        })
        result.updated++
      } else {
        await payload.create({
          collection: 'events',
          data,
        })
        result.created++
      }
    }

    const syncedEvents = await payload.find({
      collection: 'events',
      depth: 0,
      limit: 500,
      select: {
        rockEventId: true,
      },
    })
    for (const event of syncedEvents.docs) {
      if (syncedEventItemIds.has(event.rockEventId)) continue

      await payload.delete({
        collection: 'events',
        id: event.id,
      })
      result.deleted++
    }

  } catch (error) {
    result.errors.push(String(error))
  }

  return result
}
