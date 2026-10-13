import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  delete: vi.fn(),
  fetchActiveGroupMembers: vi.fn(),
  find: vi.fn(),
  getPayloadClient: vi.fn(),
  rockFetch: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }))
vi.mock('@/lib/rock-api', () => ({ rockFetch: mocks.rockFetch }))
vi.mock('./rock-group-members', () => ({
  fetchActiveGroupMembers: mocks.fetchActiveGroupMembers,
}))

vi.mock('@payloadcms/richtext-lexical', () => ({
  editorConfigFactory: { default: vi.fn().mockResolvedValue({}) },
  convertHTMLToLexical: vi.fn(),
}))

import { syncCampuses, syncEvents, syncTeamMembers } from './sync-runner'

describe('campus sync location hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.find.mockResolvedValue({ docs: [{ id: 20 }] })
    mocks.update.mockResolvedValue({})
    mocks.getPayloadClient.mockResolvedValue({
      find: mocks.find,
      update: mocks.update,
    })
  })

  it('loads each linked Rock location before mapping the campus', async () => {
    mocks.rockFetch
      .mockResolvedValueOnce([
        {
          Id: 2,
          Name: 'North',
          Description: '',
          IsActive: true,
          Order: 1,
          LocationId: 2401,
        },
      ])
      .mockResolvedValueOnce({
        Street1: '9-11 Rothwell Avenue',
        Street2: 'Rosedale',
        City: 'Auckland',
        PostalCode: '0632',
        GooglePlaceId: null,
        AttributeValues: {
          GooglePlaceId: { Value: 'north-place-id' },
        },
      })

    await expect(syncCampuses()).resolves.toMatchObject({
      entity: 'campuses',
      updated: 1,
      errors: [],
    })

    expect(mocks.rockFetch).toHaveBeenNthCalledWith(2, {
      endpoint: 'Locations/2401',
      params: { loadAttributes: 'simple' },
    })
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'campuses',
        id: 20,
        data: expect.objectContaining({
          address: {
            street: '9-11 Rothwell Avenue, Rosedale',
            city: 'Auckland',
            postalCode: '0632',
          },
          googlePlaceId: 'north-place-id',
        }),
      }),
    )
  })
})

describe('group sync isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.find.mockResolvedValue({ docs: [] })
    mocks.create.mockResolvedValue({})
    mocks.getPayloadClient.mockResolvedValue({
      create: mocks.create,
      find: mocks.find,
    })
  })

  it('continues syncing team groups after one member request fails', async () => {
    mocks.fetchActiveGroupMembers
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('member request failed'))
      .mockResolvedValueOnce([])

    const result = await syncTeamMembers()

    expect(mocks.fetchActiveGroupMembers.mock.calls.map(([id]) => id)).toEqual([
      29482, 29485, 29486,
    ])
    expect(result.errors).toEqual([
      'Rock group 29485 sync failed: Error: member request failed',
    ])
  })

})

describe('event sync during an occurrence', () => {
  const current = {
    id: 3, rockEventId: 9,
    startDate: '2026-10-17T23:30:00.000Z',
    endDate: '2026-10-18T01:30:00.000Z',
  }
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-18T00:30:00Z'))
    mocks.find.mockResolvedValue({ docs: [current] })
    mocks.getPayloadClient.mockResolvedValue({
      config: {}, find: mocks.find, create: mocks.create,
      update: mocks.update, delete: mocks.delete,
    })
  })
  afterEach(() => vi.useRealTimers())

  function source(nextStart: string | null, isPublic = true) {
    mocks.rockFetch.mockImplementation(async ({ endpoint }: { endpoint: string }) => {
      switch (endpoint) {
        case 'EventItemOccurrences': return [{
          EventItemId: 9, CampusId: null, NextStartDateTime: nextStart,
          Schedule: { EffectiveEndDate: '2026-11-08T00:00:00', iCalendarContent: 'DTSTART:20261018T123000\nDTEND:20261018T143000' },
        }]
        case 'EventItems': return [{ Id: 9, Name: 'Course', IsActive: true }]
        case 'EventCalendars': return [{ Id: 1, Name: 'Website (Public)', IsActive: true }]
        case 'EventCalendarItems': return [{ EventCalendarId: 1, EventItemId: isPublic ? 9 : 10 }]
        default: return []
      }
    })
  }

  it.each([null, '2026-10-25T12:30:00'])('keeps the running event when Rock next start changes to %s', async (nextStart) => {
    source(nextStart)
    expect(await syncEvents()).toMatchObject({ errors: [], deleted: 0, updated: 0 })
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('keeps an event with an unknown finish through its Auckland day', async () => {
    source(null)
    mocks.find.mockResolvedValue({ docs: [{ ...current, endDate: null }] })
    vi.setSystemTime(new Date('2026-10-18T10:59:59Z'))
    expect(await syncEvents()).toMatchObject({ errors: [], deleted: 0 })
    vi.setSystemTime(new Date('2026-10-18T11:00:00Z'))
    expect(await syncEvents()).toMatchObject({ errors: [], deleted: 1 })
  })

  it('removes a completed event when Rock has no next start', async () => {
    source(null)
    vi.setSystemTime(new Date('2026-10-18T01:30:00Z'))
    expect(await syncEvents()).toMatchObject({ errors: [], deleted: 1 })
    expect(mocks.delete).toHaveBeenCalledWith({ collection: 'events', id: 3 })
  })

  it('advances to the next occurrence after the current one finishes', async () => {
    source('2026-10-25T12:30:00')
    vi.setSystemTime(new Date('2026-10-18T01:30:00Z'))
    expect(await syncEvents()).toMatchObject({ errors: [], updated: 1 })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      startDate: '2026-10-24T23:30:00.000Z', endDate: '2026-10-25T01:30:00.000Z',
    }) }))
  })

  it('honours removal from the public calendar even while an event is running', async () => {
    source(null, false)
    expect(await syncEvents()).toMatchObject({ errors: [], deleted: 1 })
  })
})
