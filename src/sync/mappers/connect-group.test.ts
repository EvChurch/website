import { describe, expect, it } from 'vitest'

import { mapRockConnectGroup } from './connect-group'

describe('mapRockConnectGroup', () => {
  it('uses Rock role leadership and familiar-name fallback for public leaders', () => {
    const mapped = mapRockConnectGroup({
      Id: 10,
      Guid: '11111111-1111-4111-8111-111111111111',
      Name: 'Example Group',
      Description: '',
      IsActive: true,
      ParentGroupId: null,
      GroupCapacity: null,
      CampusId: null,
      ScheduleId: null,
      GroupLocations: [],
      Members: [
        {
          Id: 20,
          GroupId: 10,
          GroupRoleId: 30,
          Person: { Id: 40, NickName: 'Jo', LastName: 'Ng', Email: 'jo@example.com', PhotoId: 123 },
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

    expect(mapped.leaders).toEqual([{ name: 'Jo Ng', email: 'jo@example.com', photoId: 123 }])
    expect(mapped).toMatchObject({
      rockGroupGuid: '11111111-1111-4111-8111-111111111111',
      publicName: 'Example Group',
      meetingDay: null,
      meetingTime: null,
      scheduleText: null,
    })
  })

  it('maps Rock public labels and active schedule details', () => {
    const mapped = mapRockConnectGroup(
      {
        Id: 10,
        Guid: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
        Name: 'Bill & Cherrys group',
        Description: 'Rosedale (North campus)',
        IsActive: true,
        ParentGroupId: null,
        GroupCapacity: null,
        CampusId: 2,
        ScheduleId: 89,
        GroupLocations: [],
        Members: [],
      },
      {
        Id: 89,
        Description: 'Sunday at 12:30 PM',
        FriendlyScheduleText: 'Sunday at 12:30 PM',
        IsActive: true,
        WeeklyDayOfWeek: 0,
        WeeklyTimeOfDay: '12:30:00',
      },
    )

    expect(mapped).toMatchObject({
      publicName: 'Rosedale (North campus)',
      rockGroupGuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      meetingDay: 0,
      meetingTime: '12:30:00',
      scheduleText: 'Sunday at 12:30 PM',
    })
  })
})
