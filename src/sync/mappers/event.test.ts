import { describe, expect, it } from 'vitest'

import {
  getEventItemIdsForCalendar,
  mapRockEvent,
  normalizeRockDateTime,
  selectNextEventOccurrences,
} from './event'

describe('normalizeRockDateTime', () => {
  it('interprets Rock timestamps as Auckland local time', () => {
    expect(normalizeRockDateTime('2026-08-09T10:15:00')).toBe('2026-08-08T22:15:00.000Z')
    expect(normalizeRockDateTime('2026-01-11T10:15:00')).toBe('2026-01-10T21:15:00.000Z')
  })

  it('preserves timestamps that already include an offset', () => {
    expect(normalizeRockDateTime('2026-08-08T22:15:00Z')).toBe('2026-08-08T22:15:00.000Z')
  })
})

describe('mapRockEvent', () => {
  it('carries occurrence notes and contact details into the synced event', () => {
    const mapped = mapRockEvent(
      {
        EventItemId: 24,
        NextStartDateTime: '2026-08-31T19:15:00',
        CampusId: null,
        Note: '<p><strong>Israel and the Land of Palestine</strong></p>',
        ContactPersonAliasId: 7634,
        ContactEmail: 'ryan@aucklandev.co.nz',
        ContactPhone: '021 555 0123',
        Location: 'Ev Central',
      },
      {
        Id: 24,
        Name: 'Going Deeper',
        Summary: '',
        Description: '<p><br></p>',
        IsActive: true,
      },
      {
        Id: 7626,
        NickName: 'Ryan',
        LastName: 'Green',
        Email: 'ryan@aucklandev.co.nz',
        PhotoUrl: '',
      },
    )

    expect(mapped._descriptionHtml).toBe(
      '<p><strong>Israel and the Land of Palestine</strong></p>',
    )
    expect(mapped.contactPerson).toEqual({
      name: 'Ryan Green',
      email: 'ryan@aucklandev.co.nz',
      phone: '021 555 0123',
    })
  })
})

describe('selectNextEventOccurrences', () => {
  it('skips null historical occurrences and keeps the first dated occurrence per event', () => {
    const occurrences = [
      { EventItemId: 1, NextStartDateTime: null, CampusId: null },
      { EventItemId: 1, NextStartDateTime: '2026-08-10T18:30:00', CampusId: null },
      { EventItemId: 1, NextStartDateTime: '2026-08-17T18:30:00', CampusId: null },
      { EventItemId: 2, NextStartDateTime: '2026-08-15T10:00:00', CampusId: null },
    ]

    expect(selectNextEventOccurrences(occurrences)).toEqual([
      occurrences[1],
      occurrences[3],
    ])
  })
})

describe('getEventItemIdsForCalendar', () => {
  it('includes only events linked to the named calendar', () => {
    const calendars = [
      { Id: 1, Name: 'Website (Public)', IsActive: true },
      { Id: 2, Name: 'Internal', IsActive: true },
      { Id: 5, Name: 'Maturity', IsActive: true },
    ]
    const links = [
      { EventCalendarId: 1, EventItemId: 9 },
      { EventCalendarId: 2, EventItemId: 1 },
      { EventCalendarId: 5, EventItemId: 21 },
      { EventCalendarId: 1, EventItemId: 21 },
      { EventCalendarId: 5, EventItemId: 37 },
    ]

    expect([
      ...getEventItemIdsForCalendar(calendars, links, 'Website (Public)'),
    ]).toEqual([9, 21])
  })

  it('fails safely when the public calendar is unavailable', () => {
    expect(() =>
      getEventItemIdsForCalendar([], [], 'Website (Public)'),
    ).toThrow('Rock calendar not found: Website (Public)')

    expect(() =>
      getEventItemIdsForCalendar(
        [{ Id: 1, Name: 'Website (Public)', IsActive: true }],
        [],
        'Website (Public)',
      ),
    ).toThrow('Rock calendar has no events: Website (Public)')
  })
})
