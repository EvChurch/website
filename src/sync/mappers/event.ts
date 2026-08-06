import type {
  RockEventCalendar,
  RockEventCalendarItem,
  RockEventItem,
  RockEventItemOccurrence,
  RockPerson,
} from '@/lib/rock-api'
import { getRockPersonName } from './person'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function normalizeRockDateTime(value: string | null): string | null {
  if (!value) return null
  if (/Z$|[+-]\d{2}:\d{2}$/.test(value)) return new Date(value).toISOString()

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return new Date(value).toISOString()

  const localTimestamp = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0),
  )
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  let instant = localTimestamp
  for (let attempt = 0; attempt < 2; attempt++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
    )
    const representedLocalTime = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    )
    instant = localTimestamp - (representedLocalTime - instant)
  }
  return new Date(instant).toISOString()
}

export function selectNextEventOccurrences(
  occurrences: RockEventItemOccurrence[],
): RockEventItemOccurrence[] {
  const selectedEventItemIds = new Set<number>()

  return occurrences.filter((occurrence) => {
    if (!occurrence.NextStartDateTime || selectedEventItemIds.has(occurrence.EventItemId)) {
      return false
    }

    selectedEventItemIds.add(occurrence.EventItemId)
    return true
  })
}

export function getEventItemIdsForCalendar(
  calendars: RockEventCalendar[],
  links: RockEventCalendarItem[],
  calendarName: string,
): Set<number> {
  const calendar = calendars.find(
    (candidate) => candidate.IsActive && candidate.Name === calendarName,
  )
  if (!calendar) throw new Error(`Rock calendar not found: ${calendarName}`)

  const eventItemIds = new Set(
    links
      .filter((link) => link.EventCalendarId === calendar.Id)
      .map((link) => link.EventItemId),
  )
  if (eventItemIds.size === 0)
    throw new Error(`Rock calendar has no events: ${calendarName}`)

  return eventItemIds
}

export function mapRockEvent(
  rock: RockEventItemOccurrence,
  eventItem: RockEventItem,
  resolvedContactPerson?: RockPerson | null,
) {
  const contactPerson = resolvedContactPerson ?? rock.ContactPersonAlias?.Person
  const contactEmail = rock.ContactEmail || contactPerson?.Email || ''
  const contactPhone = rock.ContactPhone || ''

  return {
    title: eventItem.Name,
    slug: slugify(eventItem.Name),
    rockEventId: eventItem.Id,
    startDate: normalizeRockDateTime(rock.NextStartDateTime || null),
    // EffectiveEndDate is the recurrence boundary, not this occurrence's end time.
    endDate: null,
    // Campus relationship resolved by matching rockId in the sync runner
    _campusRockId: rock.CampusId,
    location: {
      name: rock.Location || '',
      address: '',
    },
    contactPerson: contactPerson || contactEmail || contactPhone
      ? {
          name: contactPerson ? getRockPersonName(contactPerson) : '',
          email: contactEmail,
          phone: contactPhone,
        }
      : undefined,
    _descriptionHtml: rock.Note || eventItem.Description || eventItem.Summary || '',
    _imageUrl: eventItem.Photo?.Guid
      ? `/GetImage.ashx?Guid=${eventItem.Photo.Guid}`
      : null,
    lastSyncedAt: new Date().toISOString(),
  }
}
