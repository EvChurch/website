import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rockFetchAll } = vi.hoisted(() => ({ rockFetchAll: vi.fn() }))

vi.mock('@/lib/rock-api', () => ({ rockFetchAll }))

import { fetchActiveGroupMembers } from './rock-group-members'

describe('fetchActiveGroupMembers', () => {
  beforeEach(() => rockFetchAll.mockReset())

  it('queries the GroupMembers entity with expanded people and roles', async () => {
    rockFetchAll.mockResolvedValue([])

    await fetchActiveGroupMembers(29482)

    expect(rockFetchAll).toHaveBeenCalledWith({
      endpoint: 'GroupMembers',
      getKey: expect.any(Function),
      params: {
        $filter: "GroupId eq 29482 and GroupMemberStatus eq 'Active' and IsArchived eq false",
        $expand: 'Person($expand=PhoneNumbers),GroupRole',
        $orderby: 'GroupOrder,Id',
      },
    })
  })

  it('requires a durable membership ID for pagination', async () => {
    rockFetchAll.mockResolvedValue([])

    await fetchActiveGroupMembers(29482)

    const getKey = rockFetchAll.mock.calls[0][0].getKey

    expect(() => getKey({ Person: { Id: 1 }, GroupRole: { Name: 'Member' } })).toThrow(
      'Rock group membership is missing a durable Id',
    )
  })
})
