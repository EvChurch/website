import { getDisplayLocation, toPlainText, type PublicEvent } from '@/lib/events'

const EVENT_BASE_URL = 'https://www.ev.church/events'

export function escapeCalendarText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

export function formatCalendarDate(value: string | Date): string {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export function getCanonicalEventUrl(event: Pick<PublicEvent, 'slug'>): string {
  return `${EVENT_BASE_URL}/${event.slug}`
}

export function buildEventCalendar(event: PublicEvent): string {
  if (!event.startDate) throw new Error('Cannot create a calendar entry without a start date')

  const url = getCanonicalEventUrl(event)
  const location = [getDisplayLocation(event), event.location?.address]
    .filter(Boolean)
    .join(', ')
  const description = toPlainText(event.summary)

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ev Church//Events//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:event-${event.id}@ev.church`,
    `DTSTAMP:${formatCalendarDate(event.updatedAt)}`,
    `DTSTART:${formatCalendarDate(event.startDate)}`,
    ...(event.endDate ? [`DTEND:${formatCalendarDate(event.endDate)}`] : []),
    `SUMMARY:${escapeCalendarText(event.title)}`,
    ...(description ? [`DESCRIPTION:${escapeCalendarText(description)}`] : []),
    ...(location ? [`LOCATION:${escapeCalendarText(location)}`] : []),
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}
