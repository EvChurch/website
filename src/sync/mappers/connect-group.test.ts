import { describe, expect, it } from 'vitest'

import { mapRockConnectGroup } from './connect-group'

describe('mapRockConnectGroup', () => {
  it('uses Rock role leadership and familiar-name fallback for public leaders', () => {
    const mapped = mapRockConnectGroup({
      Id: 10,
      Name: 'Example Group',
      Description: '',
      IsActive: true,
      ParentGroupId: null,
      GroupCapacity: null,
      CampusId: null,
      GroupLocations: [],
      Members: [
        {
          Id: 20,
          GroupId: 10,
          GroupRoleId: 30,
          Person: { Id: 40, NickName: 'Jo', LastName: 'Ng', Email: 'jo@example.com' },
          GroupRole: { Id: 30, Name: 'Facilitator', IsLeader: true },
          GroupOrder: 1,
        },
        {
          Id: 21,
          GroupId: 10,
          GroupRoleId: 31,
          Person: { Id: 41, FullName: 'Not a leader', Email: '' },
          GroupRole: { Id: 31, Name: 'Leader', IsLeader: false },
          GroupOrder: 2,
        },
      ],
    })

    expect(mapped.leaders).toEqual([{ name: 'Jo Ng', email: 'jo@example.com' }])
  })
})
