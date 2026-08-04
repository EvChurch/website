import { describe, expect, it } from 'vitest'

import {
  filterUpcomingEvents,
  getCampusSlug,
  getDisplayLocation,
  getRegistrationHref,
  isPastEvent,
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
        registrationUrl: 'https://example.com/phishing',
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
