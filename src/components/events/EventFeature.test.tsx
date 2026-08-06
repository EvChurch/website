import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { PublicEvent } from '@/lib/events'

import { EventFeature } from './EventFeature'

const featuredEvent: PublicEvent = {
  id: 1,
  title: 'Community Dinner',
  slug: 'community-dinner',
  summary: 'This description should stay off the featured card.',
  image: null,
  startDate: '2026-08-10T06:00:00.000Z',
  endDate: '2026-08-10T08:00:00.000Z',
  campus: { slug: 'central', name: 'Central' },
  location: { name: 'Town Hall' },
  contactPerson: null,
  registrationUrl: null,
  registrationStatus: null,
  featured: true,
  updatedAt: '2026-08-01T00:00:00.000Z',
}

describe('EventFeature', () => {
  it('renders day, time, and location without the event description', () => {
    const markup = renderToStaticMarkup(<EventFeature event={featuredEvent} />)

    expect(markup).toContain('Mon, 10 August 2026')
    expect(markup).toContain('6:00 pm–8:00 pm')
    expect(markup).toContain('Central · Town Hall')
    expect(markup).not.toContain('This description should stay off the featured card.')
  })

  it('omits the optional location row when no location is available', () => {
    const markup = renderToStaticMarkup(
      <EventFeature event={{ ...featuredEvent, campus: null, location: null }} />,
    )

    expect(markup.match(/<svg/g)).toHaveLength(2)
  })
})
