import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PublicEvent } from '@/lib/events'
import type { Campus } from '@/payload-types'

const mocks = vi.hoisted(() => ({
  getUpcomingEvents: vi.fn(),
}))

vi.mock('@/lib/events', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/events')>()),
  getUpcomingEvents: mocks.getUpcomingEvents,
}))

import { UpcomingEventsBlockComponent } from './UpcomingEventsBlockComponent'

const baseEvent: PublicEvent = {
  id: 1,
  title: 'Community Dinner',
  slug: 'community-dinner',
  summary: null,
  image: null,
  startDate: '2026-08-10T06:00:00.000Z',
  endDate: '2026-08-10T08:00:00.000Z',
  campus: { slug: 'central', name: 'Central' },
  location: null,
  contactPerson: null,
  registrationUrl: null,
  registrationStatus: null,
  featured: false,
  updatedAt: '2026-08-01T00:00:00.000Z',
}

const centralCampus: Campus = {
  id: 1,
  name: 'Central',
  slug: 'central',
  rockId: 101,
  updatedAt: '2026-08-01T00:00:00.000Z',
  createdAt: '2026-08-01T00:00:00.000Z',
}

describe('UpcomingEventsBlockComponent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the next three campus events with the shared event cards', async () => {
    mocks.getUpcomingEvents.mockResolvedValue([
      baseEvent,
      { ...baseEvent, id: 2, title: 'Newish Connect', slug: 'newish-connect' },
      { ...baseEvent, id: 3, title: 'Equip Night', slug: 'equip-night' },
      { ...baseEvent, id: 4, title: 'Fourth Event', slug: 'fourth-event' },
    ])

    const markup = renderToStaticMarkup(
      await UpcomingEventsBlockComponent({
        eyebrow: 'At Central',
        heading: 'Coming up',
        campusFilter: centralCampus,
      }),
    )

    expect(mocks.getUpcomingEvents).toHaveBeenCalledWith('central')
    expect(markup.match(/<article/g)).toHaveLength(3)
    expect(markup).toContain('At Central')
    expect(markup).toContain('Coming up')
    expect(markup).not.toContain('Fourth Event')
    expect(markup).toContain('href="/events/central"')
    expect(markup).toContain('href="/events/community-dinner"')
  })

  it('uses all campuses when no campus filter is selected', async () => {
    mocks.getUpcomingEvents.mockResolvedValue([baseEvent])

    const markup = renderToStaticMarkup(await UpcomingEventsBlockComponent({}))

    expect(mocks.getUpcomingEvents).toHaveBeenCalledWith(undefined)
    expect(markup).toContain('What’s on')
    expect(markup).toContain('Upcoming events')
    expect(markup).toContain('href="/events"')
  })

  it('does not render an empty block', async () => {
    mocks.getUpcomingEvents.mockResolvedValue([])

    expect(renderToStaticMarkup(await UpcomingEventsBlockComponent({}))).toBe('')
  })
})
