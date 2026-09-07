import { unstable_cache } from 'next/cache'

import type { Page } from '@/payload-types'
import { CACHE_TAGS } from './cache-tags'
import { getRegistrationHref, getUpcomingEvents } from './events'
import { rockFetchAll } from './rock-api'

const INTEREST_ACTION = {
  label: 'Register your interest',
  href: '?launcher=explaining-christianity',
}

interface Calendar {
  Id: number
}

interface MarkerAttribute {
  Id: number
  EntityTypeQualifierValue: string
  FieldType: { Class: string }
}

interface MarkerValue {
  Id: number
  EntityId: number | null
  Value: string | null
}

interface CalendarItem {
  Id: number
  EventItemId: number
}

async function getMarkedEventIds(): Promise<Set<number>> {
  const options = { retries: 0, timeoutMs: 3_000 }
  const [calendars, attributes] = await Promise.all([
    rockFetchAll<Calendar>({
      ...options,
      endpoint: 'EventCalendars',
      params: {
        $filter: "Name eq 'Website (Public)' and IsActive eq true",
        $select: 'Id',
      },
    }),
    rockFetchAll<MarkerAttribute>({
      ...options,
      endpoint: 'Attributes',
      params: {
        $filter: "Key eq 'ExplainingChristianity' and IsActive eq true and EntityType/Name eq 'Rock.Model.EventCalendarItem' and EntityTypeQualifierColumn eq 'EventCalendarId'",
        $select: 'Id,EntityTypeQualifierValue,FieldType/Class',
        $expand: 'FieldType',
      },
    }),
  ])

  if (calendars.length !== 1) return new Set()
  const calendarId = calendars[0].Id
  const markers = attributes.filter((attribute) =>
    attribute.EntityTypeQualifierValue === String(calendarId) &&
    attribute.FieldType.Class === 'Rock.Field.Types.BooleanFieldType',
  )
  if (markers.length !== 1) return new Set()

  const [items, values] = await Promise.all([
    rockFetchAll<CalendarItem>({
      ...options,
      endpoint: 'EventCalendarItems',
      params: {
        $filter: `EventCalendarId eq ${calendarId}`,
        $select: 'Id,EventItemId',
      },
    }),
    rockFetchAll<MarkerValue>({
      ...options,
      endpoint: 'AttributeValues',
      params: {
        $filter: `AttributeId eq ${markers[0].Id}`,
        $select: 'Id,EntityId,Value',
      },
    }),
  ])
  const markedItems = new Set(values
    .filter((value) => value.Value?.trim().toLowerCase() === 'true')
    .map((value) => value.EntityId))
  return new Set(items
    .filter((item) => markedItems.has(item.Id))
    .map((item) => item.EventItemId))
}

// Cache both the successful result and the safe fallback. A Rock outage must
// not keep an old registration link alive indefinitely through stale-on-error.
export const getExplainingChristianityAction = unstable_cache(
  async (): Promise<typeof INTEREST_ACTION> => {
    try {
      const [markedIds, events] = await Promise.all([
        getMarkedEventIds(),
        getUpcomingEvents(),
      ])
      const event = events.find((candidate) =>
        candidate.rockEventId !== undefined &&
        markedIds.has(candidate.rockEventId) &&
        getRegistrationHref(candidate) !== null,
      )
      return event
        ? { label: 'Register now', href: `/events/${encodeURIComponent(event.slug)}` }
        : INTEREST_ACTION
    } catch {
      console.warn('EC event lookup unavailable; using the interest form.')
      return INTEREST_ACTION
    }
  },
  ['explaining-christianity-action'],
  { tags: [CACHE_TAGS.events], revalidate: 300 },
)

export function applyExplainingChristianityAction(
  layout: NonNullable<Page['layout']>,
  action: typeof INTEREST_ACTION,
): NonNullable<Page['layout']> {
  const updateButton = <T extends { label: string; href: string }>(button: T): T =>
    button.href === INTEREST_ACTION.href ? { ...button, ...action } : button

  return layout.map((block) => {
    // Keep each block's distinct button variants intact.
    if (block.blockType === 'hero') return { ...block, buttons: block.buttons?.map(updateButton) }
    if (block.blockType === 'cta') return { ...block, buttons: block.buttons?.map(updateButton) }
    return block
  })
}
