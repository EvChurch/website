import { describe, expect, it } from 'vitest'

import { buildEventCalendar } from './event-sharing'
import type { PublicEvent } from './events'

const event: PublicEvent = {
  id: 10,
  title: 'Going Deeper',
  slug: 'going-deeper',
  summary: null,
  image: null,
  startDate: '2026-08-31T07:15:00.000Z',
  endDate: null,
  campus: null,
  location: { name: 'Ev Central', address: '80 Olsen Avenue, Hillsborough' },
  contactPerson: null,
  registrationUrl: null,
  registrationStatus: null,
  featured: false,
  updatedAt: '2026-08-05T00:00:00.000Z',
}

describe('buildEventCalendar', () => {
  it('creates an escaped calendar event using the canonical event URL', () => {
    const calendar = buildEventCalendar(event)

    expect(calendar).toContain('BEGIN:VCALENDAR')
    expect(calendar).toContain('DTSTART:20260831T071500Z')
    expect(calendar).toContain('SUMMARY:Going Deeper')
    expect(calendar).toContain('LOCATION:Ev Central\\, 80 Olsen Avenue\\, Hillsborough')
    expect(calendar).toContain('URL:https://ev.church/events/going-deeper')
  })
})
