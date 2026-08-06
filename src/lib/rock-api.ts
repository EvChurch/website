/**
 * Rock RMS API client.
 *
 * All Rock API calls go through this client so we have a single
 * place to manage authentication, error handling, and retries.
 */

const ROCK_API_URL = process.env.ROCK_API_URL || 'https://rock.ev.church/api'
const ROCK_API_KEY = process.env.ROCK_API_KEY || ''

type RockRequestOptions = {
  endpoint: string
  params?: Record<string, string>
  retries?: number
  method?: 'GET' | 'POST'
  body?: unknown
  timeoutMs?: number
}

class RockAPIError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    message: string,
  ) {
    super(`Rock API error ${status} on ${endpoint}: ${message}`)
    this.name = 'RockAPIError'
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function rockFetch<T>({
  endpoint,
  params,
  retries = 3,
  method = 'GET',
  body,
  timeoutMs = 15_000,
}: RockRequestOptions): Promise<T> {
  const url = new URL(`${ROCK_API_URL}/${endpoint}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Authorization-Token': ROCK_API_KEY,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
        next: { revalidate: 0 },
      })

      if (!response.ok) {
        throw new RockAPIError(
          response.status,
          endpoint,
          await response.text(),
        )
      }

      return (await response.json()) as T
    } catch (error) {
      if (
        error instanceof RockAPIError &&
        error.status < 500 &&
        error.status !== 429
      ) {
        throw error
      }
      if (attempt === retries) throw error
      // Exponential backoff: 1s, 2s, 4s
      await sleep(1000 * Math.pow(2, attempt))
    }
  }

  throw new Error('Unreachable')
}

/** Fetches an OData collection without relying on Rock's server-side page size. */
export async function rockFetchAll<T>({
  endpoint,
  params,
  pageSize = 100,
  getKey,
}: {
  endpoint: string
  params?: Record<string, string>
  pageSize?: number
  getKey?: (record: T) => string | number
}): Promise<T[]> {
  const records: T[] = []
  const seenKeys = new Set<string | number>()
  let previousFullPage: string | null = null

  for (let skip = 0; ; skip += pageSize) {
    const page = await rockFetch<T[]>({
      endpoint,
      params: {
        ...params,
        $top: String(pageSize),
        $skip: String(skip),
      },
    })

    if (getKey) {
      for (const record of page) {
        const key = getKey(record)
        if (seenKeys.has(key)) {
          throw new Error(`Rock pagination did not advance for ${endpoint}`)
        }
        seenKeys.add(key)
      }
    } else if (page.length === pageSize) {
      // Even callers without an identity selector must not loop forever when an
      // endpoint silently ignores $skip.
      const pageFingerprint = JSON.stringify(page)
      if (pageFingerprint === previousFullPage) {
        throw new Error(`Rock pagination did not advance for ${endpoint}`)
      }
      previousFullPage = pageFingerprint
    }

    records.push(...page)
    if (page.length < pageSize) return records
  }
}

/**
 * Download an image from Rock RMS by its GUID.
 * Returns the image as a Buffer with its content type.
 */
export async function rockFetchImage(
  guid: string,
  width = 1920,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const url = `${ROCK_API_URL.replace('/api', '')}/GetImage.ashx?Guid=${guid}&w=${width}`

  try {
    const response = await fetch(url, {
      headers: { 'Authorization-Token': ROCK_API_KEY },
    })

    if (!response.ok) return null

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    return { buffer, contentType }
  } catch {
    return null
  }
}

// Rock RMS entity types for webhook processing
export type RockEntityType =
  | 'Campus'
  | 'Person'
  | 'Group'
  | 'GroupMember'
  | 'EventItem'
  | 'EventItemOccurrence'
  | 'ContentChannelItem'
  | 'RegistrationInstance'

export type RockWebhookPayload = {
  entityType: RockEntityType
  entityId: number
  operation: 'create' | 'update' | 'delete'
  timestamp: string
}

// Rock API response types
export type RockCampus = {
  Id: number
  Guid?: string
  Name: string
  Description: string
  IsActive: boolean
  Order: number
  Location?: {
    Street1?: string
    City?: string
    PostalCode?: string
    GeoPoint?: { Latitude: number; Longitude: number }
    GooglePlaceId?: string
  }
  ServiceTimes?: string
  AttributeValues?: Record<string, { Value: string }>
}

export type RockPerson = {
  Id: number
  FullName?: string
  FirstName?: string
  NickName?: string
  LastName?: string
  Email: string
  PhotoUrl?: string | null
}

export type RockGroupMember = {
  Person: RockPerson
  GroupRole: { Name: string }
  GroupOrder: number | null
}

export type RockEventItem = {
  Id: number
  Guid?: string
  Name: string
  Summary: string
  Description: string
  IsActive: boolean
  Photo?: {
    Guid: string
  }
}

export type RockEventCalendar = {
  Id: number
  Name: string
  IsActive: boolean
}

export type RockEventCalendarItem = {
  EventCalendarId: number
  EventItemId: number
}

export type RockEventItemOccurrence = {
  Id?: number
  EventItemId: number
  Schedule?: {
    iCalendarContent: string
    EffectiveEndDate: string
  }
  NextStartDateTime: string | null
  CampusId: number | null
  Location?: string
  Note?: string
  ContactPersonAliasId?: number | null
  ContactEmail?: string
  ContactPhone?: string
  ContactPersonAlias?: {
    Person?: RockPerson | null
  }
}

export type RockPersonAlias = {
  Id: number
  PersonId: number
  Person?: RockPerson | null
}

export type RockContentChannelItem = {
  Id: number
  Guid?: string
  Title: string
  Content: string | null
  Status: number
  StartDateTime: string | null
  ExpireDateTime?: string | null
  Priority?: number | null
  Order?: number | null
  AttributeValues?: Record<string, { Value: string }>
}

export type RockGroup = {
  Id: number
  Name: string
  Description: string
  IsActive: boolean
  GroupCapacity: number | null
  CampusId: number | null
  Members: RockGroupMember[]
  GroupLocations: Array<{
    Location?: { Street1?: string; City?: string }
  }>
}

export type RockRegistrationInstance = {
  Id: number
  Name: string
  IsActive: boolean
  StartDateTime: string
  EndDateTime: string
  MaxAttendees: number | null
  RegistrationTemplate?: {
    EventItemId?: number
  }
}
