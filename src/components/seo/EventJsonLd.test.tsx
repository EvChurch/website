import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { PublicEvent } from '@/lib/events'
import { EventJsonLd } from './EventJsonLd'

function eventWithLocation(location: PublicEvent['location']): PublicEvent {
  return {
    id: 1,
    title: 'Explaining Christianity',
    slug: 'explaining-christianity',
    summary: null,
    image: null,
    startDate: '2026-08-17T06:30:00.000Z',
    endDate: null,
    campus: null,
    location,
    contactPerson: null,
    registrationUrl: null,
    registrationStatus: null,
    featured: false,
    updatedAt: '2026-08-14T00:00:00.000Z',
  }
}

function parseJsonLd(markup: string) {
  const json = markup.match(/<script type="application\/ld\+json">(.*)<\/script>/)?.[1]
  expect(json).toBeDefined()
  return JSON.parse(json!)
}

describe('EventJsonLd', () => {
  it('uses the full location label when Rock does not provide a separate address', () => {
    const location = '423-340 Seminar Room, 22 Symonds St'
    const data = parseJsonLd(
      renderToStaticMarkup(<EventJsonLd event={eventWithLocation({ name: location })} />),
    )

    expect(data.location.address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: location,
      addressCountry: 'NZ',
    })
  })
})
