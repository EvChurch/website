import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { PublicEvent } from '@/lib/events'
import { EventJsonLd } from './EventJsonLd'

function eventWithLocation(
  location: PublicEvent['location'],
  campus: PublicEvent['campus'] = null,
): PublicEvent {
  return {
    id: 1,
    title: 'Explaining Christianity',
    slug: 'explaining-christianity',
    summary: null,
    image: null,
    startDate: '2026-08-17T06:30:00.000Z',
    endDate: null,
    campus,
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

  it('uses and trims an explicit event address', () => {
    const data = parseJsonLd(
      renderToStaticMarkup(
        <EventJsonLd
          event={eventWithLocation({
            name: 'Ev Church Central',
            address: ' 80 Olsen Avenue ',
          })}
        />,
      ),
    )

    expect(data.location.address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '80 Olsen Avenue',
      addressCountry: 'NZ',
    })
  })

  it('uses the campus postal address instead of a venue label', () => {
    const data = parseJsonLd(
      renderToStaticMarkup(
        <EventJsonLd
          event={eventWithLocation(
            { name: 'Town Hall' },
            {
              name: 'Central',
              slug: 'central',
              address: {
                street: '80 Olsen Avenue',
                city: 'Hillsborough',
                postalCode: '1042',
              },
            },
          )}
        />,
      ),
    )

    expect(data.location).toMatchObject({
      name: 'Town Hall',
      address: {
        streetAddress: '80 Olsen Avenue, Hillsborough, 1042',
      },
    })
  })

  it('does not present an address-less venue label as a postal address', () => {
    const data = parseJsonLd(
      renderToStaticMarkup(<EventJsonLd event={eventWithLocation({ name: 'Town Hall' })} />),
    )

    expect(data.location).not.toHaveProperty('address')
  })
})
