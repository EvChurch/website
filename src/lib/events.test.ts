import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  unstableCache: vi.fn((callback: unknown) => callback),
}))

vi.mock('next/cache', () => ({
  unstable_cache: mocks.unstableCache,
}))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(),
}))

import {
  filterUpcomingEvents,
  filterEventsByCampus,
  getCampusSlug,
  getDisplayLocation,
  getEmbeddedRegistrationHref,
  getEventBySlug,
  getRegistrationHref,
  isPastEvent,
  prepareEventsListing,
  selectFeaturedEvent,
  toPlainText,
  type PublicEvent,
} from './events'

const baseEvent: PublicEvent = {
  id: 1,
  title: 'Community Dinner',
  slug: 'community-dinner',
  startDate: '2026-08-10T06:00:00.000Z',
  endDate: '2026-08-10T08:00:00.000Z',
  campus: { slug: 'central', name: 'Central' },
  summary: null,
  image: null,
  location: null,
  contactPerson: null,
  registrationUrl: null,
  registrationStatus: null,
  featured: false,
  updatedAt: '2026-08-01T00:00:00.000Z',
}

describe('event helpers', () => {
  it('caches the raw public event catalogue with its invalidation tag', () => {
    expect(mocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ['public-events'],
      { tags: ['events'], revalidate: 300 },
    )
  })

  it('caches event detail reads with the same short invalidation contract', () => {
    expect(mocks.unstableCache).toHaveBeenNthCalledWith(
      2,
      expect.any(Function),
      ['public-event-by-slug'],
      { tags: ['events'], revalidate: 300 },
    )
  })

  it('returns null when a cached event slug has no match', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const { getPayloadClient } = await import('@/lib/payload')
    vi.mocked(getPayloadClient).mockResolvedValue({ find } as never)

    await expect(getEventBySlug('missing')).resolves.toBeNull()
  })

  it('orders upcoming and currently-running events chronologically', () => {
    const now = new Date('2026-08-10T07:00:00.000Z')
    const later = { ...baseEvent, id: 2, slug: 'later', startDate: '2026-08-11T06:00:00.000Z' }
    const ended = { ...baseEvent, id: 3, slug: 'ended', endDate: '2026-08-10T06:59:00.000Z' }

    expect(filterUpcomingEvents([later, ended, baseEvent], now).map((event) => event.slug)).toEqual([
      'community-dinner',
      'later',
    ])
  })

  it('does not list undated events as upcoming', () => {
    expect(filterUpcomingEvents([{ ...baseEvent, startDate: null, endDate: null }])).toEqual([])
  })

  it('features an admin selection, otherwise Explaining Christianity', () => {
    const explainingChristianity = {
      ...baseEvent,
      id: 2,
      slug: 'explaining-christianity',
      title: 'Explaining Christianity',
    }
    const adminSelection = {
      ...baseEvent,
      id: 3,
      slug: 'going-deeper',
      title: 'Going Deeper',
      featured: true,
    }

    expect(selectFeaturedEvent([baseEvent, explainingChristianity])).toBe(explainingChristianity)
    expect(selectFeaturedEvent([explainingChristianity, adminSelection])).toBe(adminSelection)
    expect(selectFeaturedEvent([baseEvent])).toBeNull()
  })

  it('uses the end date to classify a past event', () => {
    expect(isPastEvent(baseEvent, new Date('2026-08-10T09:00:00.000Z'))).toBe(true)
    expect(isPastEvent(baseEvent, new Date('2026-08-10T07:00:00.000Z'))).toBe(false)
  })

  it('extracts a campus slug only from a populated relationship', () => {
    expect(getCampusSlug(baseEvent)).toBe('central')
    expect(getCampusSlug({ ...baseEvent, campus: 42 })).toBeNull()
  })

  it('does not repeat a campus when the venue already names it', () => {
    expect(getDisplayLocation({ ...baseEvent, location: { name: 'Ev Church Central' } })).toBe('Ev Church Central')
    expect(getDisplayLocation({ ...baseEvent, location: { name: 'Central' } })).toBe('Central')
    expect(getDisplayLocation({ ...baseEvent, location: { name: 'Town Hall' } })).toBe('Central · Town Hall')
  })

  it('includes unassigned events in every campus filter', () => {
    const central = baseEvent
    const north = { ...baseEvent, id: 2, campus: { slug: 'north', name: 'North' } }
    const allCampuses = { ...baseEvent, id: 3, campus: null }

    expect(filterEventsByCampus([central, north, allCampuses], 'north')).toEqual([
      north,
      allCampuses,
    ])
    expect(filterEventsByCampus([central, north, allCampuses], 'central')).toEqual([
      central,
      allCampuses,
    ])
  })

  it('keeps the featured event global while filtering campus cards', () => {
    const featured = {
      ...baseEvent,
      id: 2,
      slug: 'explaining-christianity',
      campus: { slug: 'unichurch', name: 'Unichurch' },
    }
    const north = { ...baseEvent, id: 3, campus: { slug: 'north', name: 'North' } }
    const allCampuses = { ...baseEvent, id: 4, campus: null }
    const events = [featured, north, allCampuses]

    expect(prepareEventsListing(events, 'north')).toEqual({
      featured,
      remaining: [north, allCampuses],
    })
    expect(prepareEventsListing(events, 'central')).toEqual({
      featured,
      remaining: [allCampuses],
    })
  })

  it('only accepts an open Rock registration URL', () => {
    expect(
      getRegistrationHref({
        ...baseEvent,
        registrationStatus: 'open',
        registrationUrl: 'https://rock.ev.church/registration/example',
      }),
    ).toBe('https://rock.ev.church/registration/example')

    expect(
      getRegistrationHref({
        ...baseEvent,
        registrationStatus: 'closed',
        registrationUrl: 'https://rock.ev.church/registration/example',
      }),
    ).toBeNull()

    expect(
      getRegistrationHref({
        ...baseEvent,
        registrationStatus: 'open',
        registrationUrl: 'https://registration.ev.church/registration/example',
      }),
    ).toBe('https://registration.ev.church/registration/example')

    expect(
      getRegistrationHref({
        ...baseEvent,
        registrationStatus: 'open',
        registrationUrl: 'https://example.com/phishing',
      }),
    ).toBeNull()
  })

  it('enables embedding only for the dedicated registration site', () => {
    expect(
      getEmbeddedRegistrationHref({
        ...baseEvent,
        registrationStatus: 'open',
        registrationUrl: 'https://registration.ev.church/registration/example',
      }),
    ).toBe('https://registration.ev.church/registration/example')
    expect(
      getEmbeddedRegistrationHref({
        ...baseEvent,
        registrationStatus: 'open',
        registrationUrl: 'https://rock.ev.church/page/404',
      }),
    ).toBeNull()
  })

  it('extracts readable text from Lexical content', () => {
    expect(
      toPlainText({
        root: {
          children: [
            { type: 'paragraph', children: [{ type: 'text', text: 'Come and join us' }] },
            { type: 'paragraph', children: [{ type: 'text', text: 'for dinner.' }] },
          ],
        },
      }),
    ).toBe('Come and join us for dinner.')
  })
})
