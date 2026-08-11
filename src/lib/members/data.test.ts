import { beforeEach, describe, expect, it, vi } from 'vitest'

const memberSession = vi.hoisted(() => ({
  profile: {
    personId: 42,
    name: 'Aroha Ngata',
    email: 'aroha@example.com',
    photoUrl: null,
  } as {
    personId: number
    name: string
    email: string
    photoUrl: string | null
  } | null,
}))

const payloadState = vi.hoisted(() => ({
  find: vi.fn(),
}))

const attendanceState = vi.hoisted(() => ({
  fetchConnectGroupAttendance: vi.fn(),
}))

vi.mock('@/auth/member-session', () => ({
  getCurrentMemberProfile: vi.fn(async () => memberSession.profile),
}))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({ find: payloadState.find })),
}))

vi.mock('@/lib/members/attendance', () => ({
  fetchConnectGroupAttendance: attendanceState.fetchConnectGroupAttendance,
}))

import {
  getGroupCurrentResources,
  getPublicLeaderResourceImage,
  getMemberGroupDetail,
  getMemberPortalHome,
  getMemberResourceAsset,
  getMemberResourceDetail,
  getMemberResources,
} from './data'

const participant = {
  id: 1,
  rockPersonId: 42,
  name: 'Aroha Ngata',
  email: 'aroha@example.com',
  phoneNumbers: [],
  photoId: 100,
  isCoach: false,
  memberships: [
    {
      rockGroupId: 10,
      rockMembershipId: 1000,
      rockRoleId: 1,
      roleName: 'Leader',
      isLeader: true,
    },
  ],
}

const group = {
  id: 5,
  rockGroupId: 10,
  name: 'Tuesday Central Connect',
  slug: 'tuesday-central-connect',
  campus: { id: 7, name: 'Central', slug: 'central' },
  location: { name: 'Mt Eden', address: 'Auckland' },
  isActive: true,
}

const otherMember = {
  id: 2,
  rockPersonId: 84,
  name: 'Wiremu Rangi',
  email: 'wiremu@example.com',
  phoneNumbers: [
    { number: '021 555 0100', typeValueId: 12, isMessagingEnabled: true },
  ],
  photoId: 200,
  isCoach: false,
  memberships: [
    {
      rockGroupId: 10,
      rockMembershipId: 1001,
      rockRoleId: 2,
      roleName: 'Member',
      isLeader: false,
    },
  ],
}

const resources = [
  {
    id: 20,
    rockId: 200,
    title: 'This Week',
    status: 1,
    startDateTime: '2026-08-03T00:00:00.000Z',
    expireDateTime: '2026-08-10T00:00:00.000Z',
    campusGuids: [],
    campuses: [],
    hosts: [],
    promotionalImageGuid: '99999999-9999-4999-8999-999999999999',
    leaderNotesFile: { guid: '11111111-1111-4111-8111-111111111111', name: 'Leader notes.pdf' },
    memberStudyFile: { guid: '22222222-2222-4222-8222-222222222222', name: 'Member study.pdf' },
    priority: 10,
    sourceOrder: 1,
  },
  {
    id: 21,
    rockId: 201,
    title: 'Central Coming Up',
    status: 1,
    startDateTime: '2026-08-12T00:00:00.000Z',
    expireDateTime: '2026-08-18T00:00:00.000Z',
    campusGuids: [{ guid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }],
    campuses: [{ id: 7, name: 'Central', slug: 'central' }],
    hosts: [],
    leaderNotesFile: { guid: '33333333-3333-4333-8333-333333333333', name: 'Notes.pdf' },
    memberStudyFile: { guid: '44444444-4444-4444-8444-444444444444', name: 'Study.pdf' },
    priority: 8,
    sourceOrder: 2,
  },
  {
    id: 22,
    rockId: 202,
    title: 'North Only',
    status: 1,
    startDateTime: '2026-08-12T00:00:00.000Z',
    expireDateTime: '2026-08-18T00:00:00.000Z',
    campusGuids: [{ guid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }],
    campuses: [{ id: 8, name: 'North', slug: 'north' }],
    hosts: [],
    leaderNotesFile: { guid: '55555555-5555-4555-8555-555555555555', name: 'Notes.pdf' },
    memberStudyFile: { guid: '66666666-6666-4666-8666-666666666666', name: 'Study.pdf' },
    priority: 6,
    sourceOrder: 3,
  },
  {
    id: 23,
    rockId: 203,
    title: 'Draft',
    status: 0,
    campusGuids: [],
    campuses: [],
    hosts: [],
    leaderNotesFile: { guid: '77777777-7777-4777-8777-777777777777', name: 'Notes.pdf' },
    memberStudyFile: { guid: '88888888-8888-4888-8888-888888888888', name: 'Study.pdf' },
    priority: 5,
    sourceOrder: 4,
  },
]

function payloadDocs(collection: string) {
  if (collection === 'connect-group-participants') return [participant]
  if (collection === 'connect-groups') return [group]
  if (collection === 'connect-group-leader-resources') return resources
  return []
}

describe('member data access', () => {
  beforeEach(() => {
    memberSession.profile = {
      personId: 42,
      name: 'Aroha Ngata',
      email: 'aroha@example.com',
      photoUrl: null,
    }
    payloadState.find.mockReset()
    attendanceState.fetchConnectGroupAttendance.mockReset()
    attendanceState.fetchConnectGroupAttendance.mockResolvedValue({
      people: {},
      summary: {
        connectGroup: { recentPercentage: null, ytdPercentage: null },
        church: { recentPercentage: null, ytdPercentage: null },
      },
      monthly: [],
    })
    payloadState.find.mockImplementation(async ({ collection, where }) => {
      const rockIdCondition = where?.and?.find(
        (condition: Record<string, unknown>) => 'rockId' in condition,
      ) as { rockId?: { equals?: number } } | undefined
      const requestedRockId = rockIdCondition?.rockId?.equals
      return {
        docs: collection === 'connect-group-leader-resources' && requestedRockId
          ? resources.filter((resource) => resource.rockId === requestedRockId)
          : payloadDocs(collection),
      }
    })
  })

  it('returns the signed-in member hub with all active group memberships', async () => {
    await expect(getMemberPortalHome()).resolves.toMatchObject({
      profile: { personId: 42, name: 'Aroha Ngata' },
      groups: [{ rockGroupId: 10, name: 'Tuesday Central Connect', isLeader: true }],
      canAccessLeaderResources: true,
    })
  })

  it('returns only people who share the requested active group', async () => {
    payloadState.find.mockImplementation(async ({ collection, where }) => {
      if (
        collection === 'connect-group-participants' &&
        where?.['memberships.rockGroupId']
      ) {
        return { docs: [participant, otherMember] }
      }
      return { docs: payloadDocs(collection) }
    })

    await expect(getMemberGroupDetail(10)).resolves.toMatchObject({
      access: 'granted',
      group: { rockGroupId: 10, name: 'Tuesday Central Connect' },
      people: [
        { rockPersonId: 42, name: 'Aroha Ngata', isLeader: true },
        {
          rockPersonId: 84,
          name: 'Wiremu Rangi',
          email: 'wiremu@example.com',
          phones: [{ number: '021 555 0100', isMessagingEnabled: true }],
          isLeader: false,
        },
      ],
    })
    expect(attendanceState.fetchConnectGroupAttendance).toHaveBeenCalledWith(10, [42, 84])
  })

  it('does not request or expose attendance for an ordinary group member', async () => {
    const ordinaryMember = {
      ...participant,
      memberships: participant.memberships.map((membership) => ({
        ...membership,
        roleName: 'Member',
        isLeader: false,
      })),
    }
    payloadState.find.mockImplementation(async ({ collection, where }) => {
      if (collection === 'connect-group-participants' && where?.['memberships.rockGroupId']) {
        return { docs: [ordinaryMember, otherMember] }
      }
      return { docs: collection === 'connect-group-participants' ? [ordinaryMember] : payloadDocs(collection) }
    })

    await expect(getMemberGroupDetail(10)).resolves.toMatchObject({
      access: 'granted',
      attendance: null,
    })
    expect(attendanceState.fetchConnectGroupAttendance).not.toHaveBeenCalled()
  })

  it('keeps the leader roster available when Rock attendance fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    attendanceState.fetchConnectGroupAttendance.mockRejectedValueOnce(new Error('Rock unavailable'))

    await expect(getMemberGroupDetail(10)).resolves.toMatchObject({
      access: 'granted',
      attendance: null,
      people: expect.any(Array),
    })
    expect(consoleError).toHaveBeenCalledWith(
      'Unable to load attendance for Connect Group 10',
      expect.any(Error),
    )
    consoleError.mockRestore()
  })

  it('denies a group the signed-in member does not belong to', async () => {
    await expect(getMemberGroupDetail(999)).resolves.toEqual({ access: 'denied' })
  })

  it('shows approved universal and matching-campus resources to leaders, including upcoming items', async () => {
    await expect(
      getMemberResources(new Date('2026-08-08T00:00:00.000Z')),
    ).resolves.toMatchObject({
      access: 'granted',
      current: [{ rockId: 200, title: 'This Week' }],
      upcoming: [{ rockId: 201, title: 'Central Coming Up' }],
      history: [],
    })
  })

  it('places an open-ended resource chronologically by its start date', async () => {
    const leaderLaunch = {
      ...resources[0],
      rockId: 240,
      title: 'Hebrews 2026 CG Leaders Launch',
      startDateTime: '2026-07-06T00:00:00.000Z',
      expireDateTime: null,
      priority: 0,
      sourceOrder: 0,
    }
    const weeklyStudy = {
      ...resources[0],
      rockId: 245,
      title: 'Hebrews Study 4',
      startDateTime: '2026-08-09T00:00:00.000Z',
      expireDateTime: '2026-08-15T00:00:00.000Z',
      priority: 0,
      sourceOrder: 0,
    }
    const earlierStudy = {
      ...resources[0],
      rockId: 239,
      title: 'Earlier Study',
      startDateTime: '2026-07-01T00:00:00.000Z',
      expireDateTime: '2026-07-05T00:00:00.000Z',
      priority: 0,
      sourceOrder: 0,
    }
    payloadState.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'connect-group-leader-resources'
        ? [leaderLaunch, weeklyStudy, earlierStudy]
        : payloadDocs(collection),
    }))

    const result = await getMemberResources(new Date('2026-08-10T00:00:00.000Z'))

    expect(result).toMatchObject({
      access: 'granted',
      current: [{ rockId: 245, title: 'Hebrews Study 4' }],
      history: [
        { rockId: 240, title: 'Hebrews 2026 CG Leaders Launch' },
        { rockId: 239, title: 'Earlier Study' },
      ],
    })
  })

  it('denies leader resources to an ordinary member', async () => {
    const ordinaryMember = {
      ...participant,
      memberships: participant.memberships.map((membership) => ({
        ...membership,
        roleName: 'Member',
        isLeader: false,
      })),
    }
    payloadState.find.mockImplementation(async ({ collection }) => ({
      docs:
        collection === 'connect-group-participants'
          ? [ordinaryMember]
          : payloadDocs(collection),
    }))

    await expect(getMemberResources()).resolves.toEqual({ access: 'denied' })
  })

  it('returns current matching-campus studies to an ordinary group member', async () => {
    const ordinaryMember = {
      ...participant,
      memberships: participant.memberships.map((membership) => ({
        ...membership,
        roleName: 'Member',
        isLeader: false,
      })),
    }
    const currentUniversal = {
      ...resources[0],
      rockId: 204,
      startDateTime: '2026-08-12T00:00:00.000Z',
      expireDateTime: '2026-08-18T00:00:00.000Z',
    }
    const expiredCentral = {
      ...resources[1],
      rockId: 205,
      title: 'Central Expired',
      startDateTime: '2026-08-01T00:00:00.000Z',
      expireDateTime: '2026-08-12T00:00:00.000Z',
    }
    const futureCentral = {
      ...resources[1],
      rockId: 206,
      title: 'Central Future',
      startDateTime: '2026-08-14T00:00:00.000Z',
      expireDateTime: '2026-08-20T00:00:00.000Z',
    }
    const currentLeaderOnly = {
      ...currentUniversal,
      rockId: 207,
      title: 'Leader briefing',
      memberStudyFile: null,
      priority: 20,
    }
    payloadState.find.mockImplementation(async ({ collection, where }) => {
      const rockIdCondition = where?.and?.find(
        (condition: Record<string, unknown>) => 'rockId' in condition,
      ) as { rockId?: { equals?: number } } | undefined
      const requestedRockId = rockIdCondition?.rockId?.equals
      return {
        docs: collection === 'connect-group-participants'
          ? [ordinaryMember]
          : collection === 'connect-group-leader-resources' && requestedRockId
            ? resources.filter((resource) => resource.rockId === requestedRockId)
            : collection === 'connect-group-leader-resources'
              ? [
                  currentLeaderOnly,
                  currentUniversal,
                  resources[1],
                  resources[2],
                  expiredCentral,
                  futureCentral,
                ]
              : payloadDocs(collection),
      }
    })

    const result = await getGroupCurrentResources(
      10,
      'central',
      'member',
      new Date('2026-08-13T00:00:00.000Z'),
    )

    expect(result?.access).toBe('granted')
    expect(result?.access === 'granted'
      ? result.current.map((resource) => resource.rockId)
      : []).toEqual([204, 201])
    await expect(getGroupCurrentResources(999, 'central', 'member')).resolves.toEqual({ access: 'denied' })
  })

  it('scopes a leader weekly banner to the group being viewed', async () => {
    const northGroup = {
      ...group,
      id: 6,
      rockGroupId: 20,
      name: 'Sunday North Connect',
      campus: { id: 8, name: 'North', slug: 'north' },
    }
    const multiGroupLeader = {
      ...participant,
      memberships: [
        ...participant.memberships,
        {
          rockGroupId: 20,
          rockMembershipId: 2000,
          rockRoleId: 1,
          roleName: 'Leader',
          isLeader: true,
        },
      ],
    }
    const centralStudy = {
      ...resources[0],
      rockId: 210,
      title: 'Central Study',
      startDateTime: '2026-08-12T00:00:00.000Z',
      expireDateTime: '2026-08-18T00:00:00.000Z',
      campusGuids: [{ guid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }],
      campuses: [{ id: 7, name: 'Central', slug: 'central' }],
      priority: 1,
    }
    const northStudy = {
      ...centralStudy,
      rockId: 211,
      title: 'North Study',
      campusGuids: [{ guid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }],
      campuses: [{ id: 8, name: 'North', slug: 'north' }],
      priority: 20,
    }
    payloadState.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'connect-group-participants'
        ? [multiGroupLeader]
        : collection === 'connect-groups'
          ? [group, northGroup]
          : collection === 'connect-group-leader-resources'
            ? [northStudy, centralStudy]
            : payloadDocs(collection),
    }))

    const result = await getGroupCurrentResources(
      10,
      'central',
      'leader',
      new Date('2026-08-13T00:00:00.000Z'),
    )

    expect(result).toMatchObject({
      access: 'granted',
      current: [{ rockId: 210, title: 'Central Study' }],
    })
  })

  it('allows ordinary members to download studies but not leader notes', async () => {
    const ordinaryMember = {
      ...participant,
      memberships: participant.memberships.map((membership) => ({
        ...membership,
        roleName: 'Member',
        isLeader: false,
      })),
    }
    const currentCentralStudy = {
      ...resources[1],
      startDateTime: '2026-08-01T00:00:00.000Z',
      expireDateTime: '2099-08-18T00:00:00.000Z',
    }
    payloadState.find.mockImplementation(async ({ collection, where }) => {
      const rockIdCondition = where?.and?.find(
        (condition: Record<string, unknown>) => 'rockId' in condition,
      ) as { rockId?: { equals?: number } } | undefined
      const requestedRockId = rockIdCondition?.rockId?.equals
      return {
        docs: collection === 'connect-group-participants'
          ? [ordinaryMember]
          : collection === 'connect-group-leader-resources'
            ? [currentCentralStudy, ...resources.filter((resource) => resource.rockId !== 201)]
            : payloadDocs(collection),
      }
    })

    await expect(getMemberResourceAsset(201, { kind: 'member-study' })).resolves.toEqual({
      kind: 'file',
      guid: '44444444-4444-4444-8444-444444444444',
      name: 'Study.pdf',
    })
    await expect(getMemberResourceAsset(201, { kind: 'leader-notes' })).resolves.toBeNull()
    await expect(getMemberResourceAsset(202, { kind: 'member-study' })).resolves.toBeNull()
    await expect(getMemberResourceDetail(201)).resolves.toEqual({ access: 'denied' })
  })

  it('authorizes resource details and protected files through the same eligibility check', async () => {
    const detail = await getMemberResourceDetail(201)
    expect(detail).toMatchObject({
      access: 'granted',
      resource: {
        rockId: 201,
        hasLeaderNotes: true,
      },
    })

    await expect(getMemberResourceDetail(202)).resolves.toEqual({ access: 'denied' })
  })

  it('only resolves protected resource assets after the same leader and campus checks', async () => {
    await expect(getMemberResourceAsset(201, { kind: 'leader-notes' })).resolves.toEqual({
      kind: 'file',
      guid: '33333333-3333-4333-8333-333333333333',
      name: 'Notes.pdf',
    })
    await expect(getMemberResourceAsset(202, { kind: 'leader-notes' })).resolves.toBeNull()
  })

  it('exposes only approved promotional images without requiring a member session', async () => {
    memberSession.profile = null

    await expect(getPublicLeaderResourceImage(200)).resolves.toEqual({
      guid: '99999999-9999-4999-8999-999999999999',
    })
    await expect(getPublicLeaderResourceImage(203)).resolves.toBeNull()
  })

  it('requires a resolved member session before reading private mirrors', async () => {
    memberSession.profile = null

    await expect(getMemberPortalHome()).resolves.toBeNull()
    expect(payloadState.find).not.toHaveBeenCalled()
  })
})
