import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  fetchActiveGroupMembers: vi.fn(),
  find: vi.fn(),
  getPayloadClient: vi.fn(),
  rockFetch: vi.fn(),
}))

vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }))
vi.mock('@/lib/rock-api', () => ({ rockFetch: mocks.rockFetch }))
vi.mock('./rock-group-members', () => ({
  fetchActiveGroupMembers: mocks.fetchActiveGroupMembers,
}))

import { syncTeamMembers } from './sync-runner'

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
