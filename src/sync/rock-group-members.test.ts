import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rockFetch } = vi.hoisted(() => ({ rockFetch: vi.fn() }))

vi.mock('@/lib/rock-api', () => ({ rockFetch }))

import { fetchActiveGroupMembers } from './rock-group-members'

describe('fetchActiveGroupMembers', () => {
  beforeEach(() => rockFetch.mockReset())

  it('queries the GroupMembers entity with expanded people and roles', async () => {
    rockFetch.mockResolvedValue([])

    await fetchActiveGroupMembers(29482)

    expect(rockFetch).toHaveBeenCalledWith({
      endpoint: 'GroupMembers',
      params: {
        $filter: "GroupId eq 29482 and GroupMemberStatus eq 'Active' and IsArchived eq false",
        $expand: 'Person,GroupRole',
        $orderby: 'GroupOrder',
      },
    })
  })
})
