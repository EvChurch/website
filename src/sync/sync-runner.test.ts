import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
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

import { syncCampuses, syncTeamMembers } from './sync-runner'

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
