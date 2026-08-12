import { getPayloadClient } from '@/lib/payload'
import { escapeCalendarText, formatCalendarDate } from '@/lib/event-sharing'

const WEEKDAYS: Record<string, { index: number; code: string }> = {
  sunday: { index: 0, code: 'SU' },
  monday: { index: 1, code: 'MO' },
  tuesday: { index: 2, code: 'TU' },
  wednesday: { index: 3, code: 'WE' },
  thursday: { index: 4, code: 'TH' },
  friday: { index: 5, code: 'FR' },
  saturday: { index: 6, code: 'SA' },
}

function nextLocalDate(weekdayIndex: number): string {
  const parts = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  const today = new Date(Date.UTC(value('year'), value('month') - 1, value('day')))
  const daysAhead = (weekdayIndex - today.getUTCDay() + 7) % 7
  today.setUTCDate(today.getUTCDate() + daysAhead)
  return today.toISOString().slice(0, 10).replaceAll('-', '')
}

function calendarTime(value: string): string | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim())
  return match ? `${match[1]}${match[2]}00` : null
}

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'campuses',
    where: { slug: { equals: slug } },
    depth: 0,
    limit: 1,
    select: {
      name: true,
      slug: true,
      address: {
        street: true,
        city: true,
        postalCode: true,
      },
      pageContent: {
        enabled: true,
        brandName: true,
        locationLabel: true,
        serviceDay: true,
        serviceOpens: true,
        serviceCloses: true,
      },
    },
  })
  const campus = result.docs[0]
  const page = campus?.pageContent
  const weekday = page?.serviceDay
    ? WEEKDAYS[page.serviceDay.trim().toLowerCase()]
    : null
  const startTime = page?.serviceOpens ? calendarTime(page.serviceOpens) : null
  const endTime = page?.serviceCloses ? calendarTime(page.serviceCloses) : null
  const summary = page?.brandName?.trim()

  if (
    !campus ||
    !page?.enabled ||
    !weekday ||
    !startTime ||
    !endTime ||
    endTime <= startTime ||
    !summary
  ) {
    return new Response('Campus calendar not found', { status: 404 })
  }

  const address = [
    campus.address?.street,
    campus.address?.city,
    campus.address?.postalCode,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(', ') || page.locationLabel?.trim() || summary
  const date = nextLocalDate(weekday.index)
  const siteUrl = 'https://www.ev.church'
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ev Church//Campus Services//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:campus-${campus.id}@ev.church`,
    `DTSTAMP:${formatCalendarDate(new Date())}`,
    `DTSTART;TZID=Pacific/Auckland:${date}T${startTime}`,
    `DTEND;TZID=Pacific/Auckland:${date}T${endTime}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${weekday.code}`,
    `SUMMARY:${escapeCalendarText(summary)}`,
    `LOCATION:${escapeCalendarText(address)}`,
    `URL:${siteUrl}/campus/${encodeURIComponent(slug)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-service.ics"`,
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
