import { getPayloadClient } from '@/lib/payload'

export type RegistrationStatus = 'open' | 'full' | 'closed' | 'coming-soon' | null

export interface PublicEvent {
  id: number | string
  title: string
  slug: string
  summary: unknown
  image: unknown
  startDate: string | null
  endDate: string | null
  campus: unknown
  location: { name?: string | null; address?: string | null } | null
  contactPerson: {
    name?: string | null
    email?: string | null
    phone?: string | null
  } | null
  registrationUrl: string | null
  registrationStatus: RegistrationStatus
  featured: boolean | null
  updatedAt: string
}

export interface PublicCampus {
  name: string
  slug: string
}

export interface PublicMedia {
  url?: string | null
  alt?: string | null
  width?: number | null
  height?: number | null
}

const AUCKLAND_TIME_ZONE = 'Pacific/Auckland'

function asPublicEvent(value: unknown): PublicEvent {
  return value as PublicEvent
}

export async function getAllEvents(): Promise<PublicEvent[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'events',
    depth: 1,
    limit: 500,
    sort: 'startDate',
  })

  return result.docs.map(asPublicEvent)
}

export async function getUpcomingEvents(campusSlug?: string): Promise<PublicEvent[]> {
  const events = filterUpcomingEvents(await getAllEvents())
  if (!campusSlug) return events
  return events.filter((event) => getCampusSlug(event) === campusSlug)
}

export async function getEventBySlug(slug: string): Promise<PublicEvent | null> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'events',
    depth: 1,
    limit: 1,
    where: { slug: { equals: slug } },
  })

  return result.docs[0] ? asPublicEvent(result.docs[0]) : null
}

export function filterUpcomingEvents(
  events: PublicEvent[],
  now = new Date(),
): PublicEvent[] {
  return events
    .filter((event) => Boolean(event.startDate) && !isPastEvent(event, now))
    .sort((a, b) => dateValue(a.startDate) - dateValue(b.startDate))
}

export function selectFeaturedEvent(events: PublicEvent[]): PublicEvent | null {
  return (
    events.find((event) => event.featured) ??
    events.find((event) => event.slug === 'explaining-christianity') ??
    null
  )
}

export function isPastEvent(event: PublicEvent, now = new Date()): boolean {
  const finalDate = event.endDate ?? event.startDate
  if (!finalDate) return false
  return new Date(finalDate).getTime() < now.getTime()
}

export function getCampusSlug(event: PublicEvent): string | null {
  if (!event.campus || typeof event.campus !== 'object') return null
  const campus = event.campus as Partial<PublicCampus>
  return typeof campus.slug === 'string' ? campus.slug : null
}

export function getCampusName(event: PublicEvent): string | null {
  if (!event.campus || typeof event.campus !== 'object') return null
  const campus = event.campus as Partial<PublicCampus>
  return typeof campus.name === 'string' ? campus.name : null
}

export function getDisplayLocation(event: PublicEvent): string | null {
  const campus = getCampusName(event)
  const location = event.location?.name?.trim() || null
  if (!location) return campus
  if (!campus) return location

  const normalizedCampus = campus.toLowerCase().replace(/[^a-z0-9]/g, '')
  const normalizedLocation = location.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (
    normalizedLocation === normalizedCampus ||
    normalizedLocation === `evchurch${normalizedCampus}`
  ) {
    return location
  }

  return `${campus} · ${location}`
}

export function getEventImage(event: PublicEvent): PublicMedia | null {
  if (!event.image || typeof event.image !== 'object') return null
  const media = event.image as PublicMedia
  return media.url ? media : null
}

export function getRegistrationHref(event: PublicEvent): string | null {
  if (event.registrationStatus !== 'open' || !event.registrationUrl) return null

  try {
    const url = new URL(event.registrationUrl)
    return url.protocol === 'https:' && url.hostname === 'rock.ev.church' ? url.toString() : null
  } catch {
    return null
  }
}

export function formatEventDate(event: PublicEvent): string {
  if (!event.startDate) return 'Date to be confirmed'

  const start = new Date(event.startDate)
  const end = event.endDate ? new Date(event.endDate) : null
  const date = new Intl.DateTimeFormat('en-NZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: AUCKLAND_TIME_ZONE,
  }).format(start)
  const startTime = new Intl.DateTimeFormat('en-NZ', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: AUCKLAND_TIME_ZONE,
  }).format(start)

  if (!end) return `${date} at ${startTime}`

  const sameDay = new Intl.DateTimeFormat('en-CA', { timeZone: AUCKLAND_TIME_ZONE }).format(start)
    === new Intl.DateTimeFormat('en-CA', { timeZone: AUCKLAND_TIME_ZONE }).format(end)
  if (!sameDay) return date

  const endTime = new Intl.DateTimeFormat('en-NZ', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: AUCKLAND_TIME_ZONE,
  }).format(end)
  return `${date}, ${startTime}–${endTime}`
}

export function formatEventDay(event: PublicEvent): string {
  if (!event.startDate) return 'Date to be confirmed'
  return new Intl.DateTimeFormat('en-NZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: AUCKLAND_TIME_ZONE,
  }).format(new Date(event.startDate))
}

export function formatEventTime(event: PublicEvent): string {
  if (!event.startDate) return 'Time to be confirmed'

  const formatter = new Intl.DateTimeFormat('en-NZ', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: AUCKLAND_TIME_ZONE,
  })
  const start = new Date(event.startDate)
  if (!event.endDate) return formatter.format(start)

  const end = new Date(event.endDate)
  const sameDay = new Intl.DateTimeFormat('en-CA', { timeZone: AUCKLAND_TIME_ZONE }).format(start)
    === new Intl.DateTimeFormat('en-CA', { timeZone: AUCKLAND_TIME_ZONE }).format(end)
  return sameDay ? `${formatter.format(start)}–${formatter.format(end)}` : formatter.format(start)
}

export function toPlainText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''

  const texts: string[] = []
  function visit(node: unknown) {
    if (!node || typeof node !== 'object') return
    const record = node as { text?: unknown; children?: unknown; root?: unknown }
    if (typeof record.text === 'string') texts.push(record.text)
    if (record.root) visit(record.root)
    if (Array.isArray(record.children)) record.children.forEach(visit)
  }
  visit(value)
  return texts.join(' ').replace(/\s+/g, ' ').trim()
}

function dateValue(value: string | null): number {
  if (!value) return Number.MAX_SAFE_INTEGER
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed
}
