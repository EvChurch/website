import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  fetchActiveGroupMembers: vi.fn(),
  find: vi.fn(),
  getPayloadClient: vi.fn(),
  revalidateTag: vi.fn(),
  rockFetch: vi.fn(),
}))

vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }))
vi.mock('@/lib/rock-api', () => ({ rockFetch: mocks.rockFetch }))
vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidateTag }))
vi.mock('./rock-group-members', () => ({
  fetchActiveGroupMembers: mocks.fetchActiveGroupMembers,
}))

import { syncConnectGroups, syncTeamMembers } from './sync-runner'

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

  it('fetches connect-group members separately and continues after a failure', async () => {
    mocks.rockFetch.mockResolvedValue([
      group(1, 'First'),
      group(2, 'Second'),
      group(3, 'Third'),
    ])
    mocks.fetchActiveGroupMembers
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('member request failed'))
      .mockResolvedValueOnce([])

    const result = await syncConnectGroups()

    expect(mocks.rockFetch).toHaveBeenCalledWith({
      endpoint: 'Groups',
      params: {
        $filter: 'GroupTypeId eq 25 and IsActive eq true',
        $expand: 'GroupLocations,Campus',
        $orderby: 'Name',
      },
    })
    expect(mocks.fetchActiveGroupMembers.mock.calls.map(([id]) => id)).toEqual([
      1, 2, 3,
    ])
    expect(mocks.create).toHaveBeenCalledTimes(2)
    expect(result.errors).toEqual([
      'Rock group 2 sync failed: Error: member request failed',
    ])
  })
})

function group(Id: number, Name: string) {
  return {
    Id,
    Name,
    Description: '',
    IsActive: true,
    GroupCapacity: null,
    CampusId: null,
    GroupLocations: [],
  }
}
