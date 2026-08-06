import { describe, expect, it } from 'vitest'

import type { RockGroupMember } from '@/lib/rock-api'
import { mapRockTeamMember } from './team-member'

describe('mapRockTeamMember', () => {
  it('uses zero when Rock has no explicit group order', () => {
    const member: RockGroupMember = {
      Person: {
        Id: 42,
        FullName: 'Example Person',
        Email: 'person@example.test',
      },
      GroupRole: { Name: 'Leader' },
      GroupOrder: null,
    }

    expect(mapRockTeamMember(member, 29482).order).toBe(0)
  })
})
