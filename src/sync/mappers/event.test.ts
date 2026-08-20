import { describe, expect, it } from 'vitest'

import {
  getEventItemIdsWithUpcomingOccurrences,
  getEventItemIdsForCalendar,
  getRegistrationForOccurrence,
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

  it('clears a previously synced contact when Rock has no contact details', () => {
    const mapped = mapRockEvent(
      {
        EventItemId: 21,
        NextStartDateTime: '2026-08-15T10:00:00',
        CampusId: null,
        ContactPersonAliasId: null,
        ContactEmail: '',
        ContactPhone: '',
        Location: 'Ev North',
      },
      {
        Id: 21,
        Name: 'Refresh',
        Summary: '',
        Description: '',
        IsActive: true,
      },
      null,
    )

    expect(mapped.contactPerson).toEqual({
      name: null,
      email: null,
      phone: null,
      photo: null,
    })
  })
})

describe('getRegistrationForOccurrence', () => {
  const linkage = {
    Id: 88,
    EventItemOccurrenceId: 170,
    RegistrationInstanceId: 81,
    RegistrationInstance: {
      Id: 81,
      Name: 'Next Steps 30 Aug',
      IsActive: true,
      StartDateTime: '2026-08-17T00:00:00',
      EndDateTime: '2026-08-30T23:59:59',
      MaxAttendees: 20,
    },
  }

  it('builds the public entry URL for one open linked instance', () => {
    expect(
      getRegistrationForOccurrence(
        170,
        [linkage],
        'https://registration.ev.church/registration',
        new Date('2026-08-20T00:00:00.000Z'),
      ),
    ).toEqual({
      registrationUrl:
        'https://registration.ev.church/registration?RegistrationInstanceId=81',
      registrationStatus: 'open',
      registrationCapacity: 20,
    })
  })

  it('reports future and ended registration windows without exposing the wrong status', () => {
    expect(
      getRegistrationForOccurrence(
        170,
        [linkage],
        'https://rock.ev.church/page/404',
        new Date('2026-08-01T00:00:00.000Z'),
      ).registrationStatus,
    ).toBe('coming-soon')
    expect(
      getRegistrationForOccurrence(
        170,
        [linkage],
        'https://rock.ev.church/page/404',
        new Date('2026-09-01T00:00:00.000Z'),
      ).registrationStatus,
    ).toBe('closed')
  })

  it('clears registration when the linkage is missing, ambiguous, or unsafe', () => {
    const emptyRegistration = {
      registrationUrl: null,
      registrationStatus: null,
      registrationCapacity: null,
    }

    expect(
      getRegistrationForOccurrence(
        999,
        [linkage],
        'https://rock.ev.church/page/404',
      ),
    ).toEqual(emptyRegistration)
    expect(
      getRegistrationForOccurrence(
        170,
        [linkage, { ...linkage, Id: 89 }],
        'https://rock.ev.church/page/404',
      ),
    ).toEqual(emptyRegistration)
    expect(
      getRegistrationForOccurrence(170, [linkage], 'http://rock.ev.church/page/404'),
    ).toEqual(emptyRegistration)
    expect(
      getRegistrationForOccurrence(170, [linkage], 'https://example.test/registration'),
    ).toEqual(emptyRegistration)
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

describe('getEventItemIdsWithUpcomingOccurrences', () => {
  it('excludes public event items that no longer have an upcoming occurrence', () => {
    const publicEventItemIds = new Set([21, 30])
    const eventItems = [
      { Id: 21, Name: 'Refresh', Summary: '', Description: '', IsActive: true },
      { Id: 30, Name: 'Mania', Summary: '', Description: '', IsActive: true },
    ]
    const occurrences = [
      { EventItemId: 21, NextStartDateTime: '2026-08-15T10:00:00', CampusId: null },
      {
        EventItemId: 30,
        NextStartDateTime: '2027-01-04T09:00:00',
        CampusId: null,
        Schedule: {
          iCalendarContent: '',
          EffectiveEndDate: '2026-01-16T09:00:00',
        },
      },
    ]

    expect([
      ...getEventItemIdsWithUpcomingOccurrences(
        occurrences,
        eventItems,
        publicEventItemIds,
        new Date('2026-08-13T00:00:00.000Z'),
      ),
    ]).toEqual([21])
  })
})
