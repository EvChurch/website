import { describe, expect, it } from 'vitest'

import { mapRockConnectGroupParticipant } from './connect-group-participant'

describe('mapRockConnectGroupParticipant', () => {
  it('normalizes contact details and active Connect Group memberships', () => {
    const mapped = mapRockConnectGroupParticipant(
      {
        Id: 101,
        NickName: '  Sam ',
        LastName: ' Taylor ',
        Email: ' SAM@example.com ',
        PhotoId: 222,
        PhoneNumbers: [
          {
            NumberFormatted: ' 021 123 4567 ',
            NumberTypeValueId: 12,
            IsMessagingEnabled: true,
          },
          { Number: '09 555 0100', NumberTypeValueId: 13 },
          { Number: '09 555 0100', NumberTypeValueId: 13 },
          { Number: '021 000 0000', IsUnlisted: true },
        ],
      },
      [
        {
          Id: 301,
          GroupId: 401,
          GroupRoleId: 501,
          Person: { Id: 101, Email: '' },
          GroupRole: { Id: 501, Name: 'Connect Group Leader', IsLeader: true },
          GroupOrder: 1,
        },
        {
          Id: 302,
          GroupId: 402,
          GroupRoleId: 502,
          Person: { Id: 101, Email: '' },
          GroupRole: { Id: 502, Name: 'Member' },
          GroupOrder: 2,
        },
      ],
      true,
      [401, 402],
    )

    expect(mapped).toEqual({
      rockPersonId: 101,
      name: 'Sam Taylor',
      email: 'SAM@example.com',
      phoneNumbers: [
        { number: '021 123 4567', typeValueId: 12, isMessagingEnabled: true },
        { number: '09 555 0100', typeValueId: 13, isMessagingEnabled: false },
      ],
      photoId: 222,
      isCoach: true,
      coachedGroups: [
        { rockGroupId: 401 },
        { rockGroupId: 402 },
      ],
      memberships: [
        {
          rockGroupId: 401,
          rockMembershipId: 301,
          rockRoleId: 501,
          roleName: 'Connect Group Leader',
          isLeader: true,
        },
        {
          rockGroupId: 402,
          rockMembershipId: 302,
          rockRoleId: 502,
          roleName: 'Member',
          isLeader: false,
        },
      ],
    })
  })

  it('uses safe nulls and ignores memberships belonging to another person', () => {
    expect(
      mapRockConnectGroupParticipant(
        { Id: 7, FirstName: ' Jo ', LastName: ' Ng ', Email: '' },
        [
          {
            Id: 8,
            GroupId: 9,
            GroupRoleId: 10,
            Person: { Id: 99, Email: '' },
            GroupRole: { Id: 10, Name: 'Member' },
            GroupOrder: null,
          },
        ],
      ),
    ).toEqual({
      rockPersonId: 7,
      name: 'Jo Ng',
      email: null,
      phoneNumbers: [],
      photoId: null,
      isCoach: false,
      coachedGroups: [],
      memberships: [],
    })
  })
})
