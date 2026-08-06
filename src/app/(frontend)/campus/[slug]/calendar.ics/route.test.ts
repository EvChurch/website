import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ find: vi.fn() }))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({ find: mocks.find })),
}))

import { GET } from './route'

describe('campus service calendar', () => {
  beforeEach(() => {
    mocks.find.mockResolvedValue({
      docs: [
        {
          id: 42,
          name: 'North',
          slug: 'north',
          address: {
            street: '9-11 Rothwell Avenue',
            city: 'Rosedale, Auckland',
            postalCode: '',
          },
          pageContent: {
            enabled: true,
            brandName: 'Ev North',
            locationLabel: 'Rosedale, Auckland',
            serviceDay: 'Sunday',
            serviceOpens: '10:15',
            serviceCloses: '11:30',
          },
        },
      ],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('builds a recurring calendar event entirely from managed campus data', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T00:00:00Z'))
    const response = await GET(new Request('http://localhost/campus/north/calendar.ics'), {
      params: Promise.resolve({ slug: 'north' }),
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/calendar')
    expect(body).toContain('SUMMARY:Ev North')
    expect(body).toContain('LOCATION:9-11 Rothwell Avenue\\, Rosedale\\, Auckland')
    expect(body).toContain('UID:campus-42@ev.church')
    expect(body).toContain('DTSTART;TZID=Pacific/Auckland:20260809T101500')
    expect(body).toContain('DTEND;TZID=Pacific/Auckland:20260809T113000')
    expect(body).toContain('RRULE:FREQ=WEEKLY;BYDAY=SU')
  })

  it('returns 404 when the managed campus page is unavailable', async () => {
    mocks.find.mockResolvedValue({ docs: [] })

    const response = await GET(new Request('http://localhost/campus/missing/calendar.ics'), {
      params: Promise.resolve({ slug: 'missing' }),
    })

    expect(response.status).toBe(404)
  })

  it('maps other weekdays and falls back to the managed location label', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T00:00:00Z'))
    mocks.find.mockResolvedValue({
      docs: [
        {
          id: 43,
          name: 'Campus',
          slug: 'campus',
          address: {},
          pageContent: {
            enabled: true,
            brandName: 'Ev Campus',
            locationLabel: 'Managed venue',
            serviceDay: 'Monday',
            serviceOpens: '18:00',
            serviceCloses: '19:15',
          },
        },
      ],
    })

    const response = await GET(new Request('http://localhost/campus/campus/calendar.ics'), {
      params: Promise.resolve({ slug: 'campus' }),
    })
    const body = await response.text()

    expect(body).toContain('DTSTART;TZID=Pacific/Auckland:20260810T180000')
    expect(body).toContain('DTEND;TZID=Pacific/Auckland:20260810T191500')
    expect(body).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO')
    expect(body).toContain('LOCATION:Managed venue')
  })

  it.each([
    ['25:99', '11:30'],
    ['10:15', '09:45'],
    ['10:15', '10:15'],
  ])('returns 404 for an invalid managed time range %s-%s', async (opens, closes) => {
    mocks.find.mockResolvedValue({
      docs: [
        {
          id: 42,
          slug: 'north',
          pageContent: {
            enabled: true,
            brandName: 'Ev North',
            serviceDay: 'Sunday',
            serviceOpens: opens,
            serviceCloses: closes,
          },
        },
      ],
    })

    const response = await GET(new Request('http://localhost/campus/north/calendar.ics'), {
      params: Promise.resolve({ slug: 'north' }),
    })

    expect(response.status).toBe(404)
  })
})
