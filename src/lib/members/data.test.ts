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
  create: vi.fn(),
  update: vi.fn(),
}))

const attendanceState = vi.hoisted(() => ({
  fetchConnectGroupAttendance: vi.fn(),
}))

vi.mock('@/auth/member-session', () => ({
  getCurrentMemberProfile: vi.fn(async () => memberSession.profile),
}))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: vi.fn(async () => ({ find: payloadState.find, create: payloadState.create, update: payloadState.update })),
}))

vi.mock('@/lib/members/attendance', () => ({
  fetchConnectGroupAttendance: attendanceState.fetchConnectGroupAttendance,
}))

import {
  authorizeConnectGroupAttendanceLeader,
  createMemberGroupComment,
  deleteMemberGroupComment,
  getLedConnectGroups,
  getGroupCurrentResources,
  getPublicLeaderResourceImage,
  getMemberGroupCoaching,
  getMemberGroupDetail,
  getMemberGroupCommentThread,
  getMemberPortalHome,
  getMemberResourceAsset,
  getMemberResourceDetail,
  getMemberResources,
  getSharedMemberAvatar,
  updateMemberGroupComment,
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
    payloadState.create.mockReset()
    payloadState.create.mockResolvedValue({ id: 1 })
    payloadState.update.mockReset()
    payloadState.update.mockResolvedValue({ docs: [{ id: 1 }] })
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

  it('returns a coach own group first followed by the groups they coach', async () => {
    const coachedParticipant = {
      ...participant,
      isCoach: true,
      coachedGroups: [
        { rockGroupId: 10 },
        { rockGroupId: 11 },
        { rockGroupId: 12 },
      ],
    }
    const coachedGroups = [
      { ...group, id: 6, rockGroupId: 12, name: 'Wednesday Connect' },
      group,
      { ...group, id: 7, rockGroupId: 11, name: 'Monday Connect' },
    ]
    payloadState.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'connect-group-participants'
        ? [coachedParticipant]
        : collection === 'connect-groups'
          ? coachedGroups
          : [],
    }))

    await expect(getMemberPortalHome()).resolves.toMatchObject({
      groups: [
        { rockGroupId: 10, isCoached: false, isCoach: true, roleName: 'Coach' },
        { rockGroupId: 11, isCoached: true, isCoach: true, roleName: 'Coach' },
        { rockGroupId: 12, isCoached: true, isCoach: true, roleName: 'Coach' },
      ],
    })
  })

  it('returns only active groups the member explicitly leads', async () => {
    const ordinaryGroup = { ...group, id: 6, rockGroupId: 11, name: 'Thursday Connect' }
    const coachParticipant = {
      ...participant,
      isCoach: true,
      memberships: [
        ...participant.memberships,
        {
          rockGroupId: 11,
          rockMembershipId: 1002,
          rockRoleId: 2,
          roleName: 'Member',
          isLeader: false,
        },
      ],
    }
    payloadState.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'connect-group-participants'
        ? [coachParticipant]
        : collection === 'connect-groups'
          ? [ordinaryGroup, group]
          : [],
    }))

    await expect(getLedConnectGroups()).resolves.toMatchObject({
      groups: [{ rockGroupId: 10, name: 'Tuesday Central Connect', isLeader: true }],
    })
  })

  it('returns a leader-only context with the current active roster', async () => {
    payloadState.find.mockImplementation(async ({ collection, where }) => {
      if (
        collection === 'connect-group-participants' &&
        where?.['memberships.rockGroupId']
      ) {
        return { docs: [participant, otherMember] }
      }
      return { docs: payloadDocs(collection) }
    })

    await expect(authorizeConnectGroupAttendanceLeader(10)).resolves.toMatchObject({
      access: 'granted',
      group: { rockGroupId: 10, name: 'Tuesday Central Connect', isLeader: true },
      people: [
        { rockPersonId: 42, isLeader: true },
        { rockPersonId: 84, isLeader: false },
      ],
    })
    expect(attendanceState.fetchConnectGroupAttendance).not.toHaveBeenCalled()
  })

  it('denies leader context to coaches, ordinary members, and another group leader', async () => {
    const coachOnly = {
      ...participant,
      isCoach: true,
      memberships: participant.memberships.map((membership) => ({
        ...membership,
        roleName: 'Member',
        isLeader: false,
      })),
    }
    payloadState.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'connect-group-participants' ? [coachOnly] : [group],
    }))

    await expect(authorizeConnectGroupAttendanceLeader(10)).resolves.toEqual({ access: 'denied' })
    await expect(authorizeConnectGroupAttendanceLeader(11)).resolves.toEqual({ access: 'denied' })
    await expect(authorizeConnectGroupAttendanceLeader(Number.NaN)).resolves.toEqual({ access: 'denied' })
  })

  it('keeps attendance entry leader-only for a coached group', async () => {
    const coachedParticipant = {
      ...participant,
      isCoach: true,
      coachedGroups: [{ rockGroupId: 11 }],
    }
    payloadState.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'connect-group-participants' ? [coachedParticipant] : [],
    }))

    await expect(authorizeConnectGroupAttendanceLeader(11)).resolves.toEqual({
      access: 'denied',
    })
  })

  it('returns null attendance leader data when signed out', async () => {
    memberSession.profile = null

    await expect(getLedConnectGroups()).resolves.toBeNull()
    await expect(authorizeConnectGroupAttendanceLeader(10)).resolves.toBeNull()
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

  it('allows a coach to view a group in their coaching group', async () => {
    const coachedParticipant = {
      ...participant,
      isCoach: true,
      coachedGroups: [{ rockGroupId: 11 }],
    }
    const coachedGroup = { ...group, id: 6, rockGroupId: 11, name: 'Thursday Connect' }
    payloadState.find.mockImplementation(async ({ collection, where }) => {
      if (collection === 'connect-group-participants' && where?.['memberships.rockGroupId']) {
        return { docs: [otherMember] }
      }
      return {
        docs: collection === 'connect-group-participants'
          ? [coachedParticipant]
          : collection === 'connect-groups'
            ? [coachedGroup]
            : [],
      }
    })

    await expect(getMemberGroupDetail(11)).resolves.toMatchObject({
      access: 'granted',
      group: { rockGroupId: 11, isCoached: true, isLeader: false },
      attendance: expect.any(Object),
    })
  })

  it('denies a coach access to a group outside their coaching group', async () => {
    const coachedParticipant = {
      ...participant,
      isCoach: true,
      coachedGroups: [{ rockGroupId: 11 }],
    }
    payloadState.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'connect-group-participants' ? [coachedParticipant] : [],
    }))

    await expect(getMemberGroupDetail(12)).resolves.toEqual({ access: 'denied' })
  })

  it('shares roster avatars with the coach of that group only', async () => {
    const coachedParticipant = {
      ...participant,
      isCoach: true,
      coachedGroups: [{ rockGroupId: 11 }],
    }
    const coachedMember = {
      ...otherMember,
      memberships: [{
        ...otherMember.memberships[0],
        rockGroupId: 11,
      }],
    }
    const unrelatedMember = {
      ...otherMember,
      rockPersonId: 85,
      photoId: 201,
      memberships: [{
        ...otherMember.memberships[0],
        rockGroupId: 12,
      }],
    }
    payloadState.find.mockImplementation(async ({ collection, where }) => {
      if (collection !== 'connect-group-participants') return { docs: [] }
      const requestedPersonId = where?.rockPersonId?.equals
      if (requestedPersonId === 84) return { docs: [coachedMember] }
      if (requestedPersonId === 85) return { docs: [unrelatedMember] }
      return { docs: [coachedParticipant] }
    })

    await expect(getSharedMemberAvatar(84)).resolves.toEqual({ photoId: 200 })
    await expect(getSharedMemberAvatar(85)).resolves.toBeNull()
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

  it('shows leaders their full resources plus member-safe studies from other campuses', async () => {
    await expect(
      getMemberResources(new Date('2026-08-08T00:00:00.000Z')),
    ).resolves.toMatchObject({
      access: 'granted',
      current: [{ rockId: 200, title: 'This Week' }],
      upcoming: [
        { rockId: 201, title: 'Central Coming Up', hasLeaderNotes: true },
        { rockId: 202, title: 'North Only', hasLeaderNotes: false, youtubeUrl: null },
      ],
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

  it('shows ordinary members approved studies without leader-only fields', async () => {
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

    await expect(getMemberResources()).resolves.toMatchObject({
      access: 'granted',
      history: expect.arrayContaining([
        expect.objectContaining({
          rockId: 200,
          hasLeaderNotes: false,
          youtubeUrl: null,
          hosts: [],
        }),
      ]),
    })
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
      const resourceDocs = requestedRockId
        ? [currentCentralStudy, ...resources].filter((resource) => resource.rockId === requestedRockId)
        : [currentCentralStudy, ...resources.filter((resource) => resource.rockId !== 201)]
      return {
        docs: collection === 'connect-group-participants'
          ? [ordinaryMember]
          : collection === 'connect-group-leader-resources'
            ? resourceDocs
            : payloadDocs(collection),
      }
    })

    await expect(getMemberResourceAsset(201, { kind: 'member-study' })).resolves.toEqual({
      kind: 'file',
      guid: '44444444-4444-4444-8444-444444444444',
      name: 'Study.pdf',
    })
    await expect(getMemberResourceAsset(201, { kind: 'leader-notes' })).resolves.toBeNull()
    await expect(getMemberResourceAsset(202, { kind: 'member-study' })).resolves.toEqual({
      kind: 'file',
      guid: '66666666-6666-4666-8666-666666666666',
      name: 'Study.pdf',
    })
    await expect(getMemberResourceDetail(201)).resolves.toMatchObject({
      access: 'granted',
      resource: {
        rockId: 201,
        hasLeaderNotes: false,
        youtubeUrl: null,
        hosts: [],
      },
    })
  })

  it('allows a signed-in member without a participant mirror to browse and download studies', async () => {
    payloadState.find.mockImplementation(async ({ collection, where }) => {
      const rockIdCondition = where?.and?.find(
        (condition: Record<string, unknown>) => 'rockId' in condition,
      ) as { rockId?: { equals?: number } } | undefined
      const requestedRockId = rockIdCondition?.rockId?.equals
      return {
        docs: collection === 'connect-group-participants'
          ? []
          : collection === 'connect-group-leader-resources' && requestedRockId
            ? resources.filter((resource) => resource.rockId === requestedRockId)
            : payloadDocs(collection),
      }
    })

    await expect(getMemberResources()).resolves.toMatchObject({
      access: 'granted',
      history: expect.arrayContaining([
        expect.objectContaining({ rockId: 200, hasLeaderNotes: false }),
      ]),
    })
    await expect(getMemberResourceAsset(200, { kind: 'member-study' })).resolves.toEqual({
      kind: 'file',
      guid: '22222222-2222-4222-8222-222222222222',
      name: 'Member study.pdf',
    })
    await expect(getMemberResourceAsset(200, { kind: 'leader-notes' })).resolves.toBeNull()
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

    await expect(getMemberResourceDetail(202)).resolves.toMatchObject({
      access: 'granted',
      resource: {
        rockId: 202,
        hasLeaderNotes: false,
        youtubeUrl: null,
      },
    })
  })

  it('authorizes coach-only resource details while still rejecting drafts', async () => {
    const coachOnly = {
      ...participant,
      isCoach: true,
      memberships: participant.memberships.map((membership) => ({
        ...membership,
        roleName: 'Member',
        isLeader: false,
      })),
    }
    payloadState.find.mockImplementation(async ({ collection, where }) => {
      const rockIdCondition = where?.and?.find(
        (condition: Record<string, unknown>) => 'rockId' in condition,
      ) as { rockId?: { equals?: number } } | undefined
      const requestedRockId = rockIdCondition?.rockId?.equals
      return {
        docs: collection === 'connect-group-participants'
          ? [coachOnly]
          : collection === 'connect-group-leader-resources' && requestedRockId
            ? resources.filter((resource) => resource.rockId === requestedRockId)
            : payloadDocs(collection),
      }
    })

    await expect(getMemberResourceDetail(202)).resolves.toMatchObject({
      access: 'granted',
      resource: { rockId: 202 },
    })
    await expect(getMemberResourceDetail(203)).resolves.toEqual({ access: 'denied' })
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

  it('shows leaders only shared group comments', async () => {
    payloadState.find.mockImplementation(async ({ collection, where }) => ({
      docs: collection === 'connect-group-participants'
        ? [participant]
        : collection === 'connect-group-comments'
          ? [{ id: 1, authorName: 'Coach', body: 'Shared note', visibility: 'leaders-and-coaches', createdAt: '2026-08-18T00:00:00.000Z' }]
          : payloadDocs(collection),
      where,
    }))

    await expect(getMemberGroupCommentThread(10)).resolves.toMatchObject({
      access: 'granted',
      canPostCoachesOnly: false,
      comments: [{ body: 'Shared note', coachesOnly: false }],
    })
    expect(payloadState.find).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { and: [
        { rockGroupId: { equals: 10 } },
        { visibility: { equals: 'leaders-and-coaches' } },
      ] },
    }))
  })

  it('lists coaches and leaders for an authorized coaching page', async () => {
    const coach = {
      ...otherMember,
      rockPersonId: 88,
      name: 'Moana Coach',
      isCoach: true,
      coachedGroups: [{ rockGroupId: 10 }],
      memberships: [],
    }
    payloadState.find.mockImplementation(async ({ collection, where }) => ({
      docs: collection === 'connect-groups'
        ? [group]
        : collection === 'connect-group-participants' && 'rockPersonId' in (where as object)
          ? [participant]
          : collection === 'connect-group-participants'
            ? [participant, coach, otherMember]
            : [],
    }))

    await expect(getMemberGroupCoaching(10)).resolves.toMatchObject({
      access: 'granted',
      group: { rockGroupId: 10, name: 'Tuesday Central Connect' },
      people: [
        { rockPersonId: 88, name: 'Moana Coach', isCoach: true, isLeader: false },
        { rockPersonId: 42, name: 'Aroha Ngata', isCoach: false, isLeader: true },
      ],
    })
  })

  it('shows coaches coach-only comments and permits creating them', async () => {
    const coach = {
      ...participant,
      memberships: participant.memberships.map((membership) => ({ ...membership, isLeader: false, roleName: 'Member' })),
      isCoach: true,
      coachedGroups: [{ rockGroupId: 10 }],
    }
    payloadState.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'connect-group-participants'
        ? [coach]
        : collection === 'connect-group-comments'
          ? [{ id: 2, authorName: 'Coach', body: 'Private note', visibility: 'coaches-only', createdAt: '2026-08-18T00:00:00.000Z' }]
          : payloadDocs(collection),
    }))

    await expect(getMemberGroupCommentThread(10)).resolves.toMatchObject({
      access: 'granted',
      canPostCoachesOnly: true,
      comments: [{ body: 'Private note', coachesOnly: true }],
    })
    await expect(createMemberGroupComment(10, { body: '  Coach update  ', coachesOnly: true })).resolves.toEqual({ ok: true })
    expect(payloadState.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ body: 'Coach update', visibility: 'coaches-only' }),
    }))
  })

  it('prevents leaders from creating coach-only comments', async () => {
    await expect(createMemberGroupComment(10, { body: 'Private note', coachesOnly: true })).resolves.toMatchObject({ ok: false })
    expect(payloadState.create).not.toHaveBeenCalled()
  })

  it('allows an author to edit their own recent comment', async () => {
    payloadState.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'connect-group-participants'
        ? [participant]
        : collection === 'connect-group-comments'
          ? [{ id: 5, authorRockPersonId: 42, createdAt: new Date().toISOString(), deletedAt: null }]
          : payloadDocs(collection),
    }))

    await expect(updateMemberGroupComment(10, 5, { body: 'Updated' }))
      .resolves.toEqual({ ok: true })
    expect(payloadState.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'connect-group-comments',
      limit: 1,
      where: { and: [
        { id: { equals: 5 } },
        { rockGroupId: { equals: 10 } },
        { authorRockPersonId: { equals: 42 } },
        { deletedAt: { exists: false } },
      ] },
      data: { body: 'Updated' },
    }))
  })

  it('does not allow editing after one hour', async () => {
    payloadState.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'connect-group-participants'
        ? [participant]
        : collection === 'connect-group-comments'
          ? [{ id: 5, authorRockPersonId: 42, createdAt: new Date(Date.now() - 61 * 60_000).toISOString(), deletedAt: null }]
          : payloadDocs(collection),
    }))

    await expect(updateMemberGroupComment(10, 5, { body: 'Too late' }))
      .resolves.toEqual({ ok: false })
    expect(payloadState.update).not.toHaveBeenCalled()
  })

  it('soft-deletes an owned comment with the deleting person recorded', async () => {
    payloadState.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'connect-group-participants'
        ? [participant]
        : collection === 'connect-group-comments'
          ? [{ id: 5, authorRockPersonId: 42, createdAt: new Date().toISOString(), deletedAt: null }]
          : payloadDocs(collection),
    }))

    await expect(deleteMemberGroupComment(10, 5)).resolves.toEqual({ ok: true })
    expect(payloadState.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'connect-group-comments',
      limit: 1,
      data: expect.objectContaining({
        body: '[deleted]',
        deletedByRockPersonId: 42,
        deletedByName: 'Aroha Ngata',
      }),
    }))
  })

  it('prevents a former coach from changing their coach-only comments', async () => {
    payloadState.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'connect-group-participants'
        ? [participant]
        : collection === 'connect-group-comments'
          ? [{ id: 5, authorRockPersonId: 42, visibility: 'coaches-only', createdAt: new Date().toISOString(), deletedAt: null }]
          : payloadDocs(collection),
    }))

    await expect(updateMemberGroupComment(10, 5, { body: 'Former coach edit' }))
      .resolves.toEqual({ ok: false })
    await expect(deleteMemberGroupComment(10, 5)).resolves.toEqual({ ok: false })
    expect(payloadState.update).not.toHaveBeenCalled()
  })

  it('reports a comment mutation that lost its compare-and-set race', async () => {
    payloadState.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'connect-group-participants'
        ? [participant]
        : collection === 'connect-group-comments'
          ? [{ id: 5, authorRockPersonId: 42, visibility: 'leaders-and-coaches', createdAt: new Date().toISOString(), deletedAt: null }]
          : payloadDocs(collection),
    }))
    payloadState.update.mockResolvedValue({ docs: [] })

    await expect(updateMemberGroupComment(10, 5, { body: 'Racing edit' }))
      .resolves.toEqual({ ok: false })
  })

  it('prevents ordinary group members from reading or creating comments', async () => {
    const member = {
      ...participant,
      memberships: participant.memberships.map((membership) => ({
        ...membership,
        isLeader: false,
        roleName: 'Member',
      })),
    }
    payloadState.find.mockImplementation(async ({ collection }) => ({
      docs: collection === 'connect-group-participants' ? [member] : payloadDocs(collection),
    }))

    await expect(getMemberGroupCommentThread(10)).resolves.toEqual({ access: 'denied' })
    await expect(createMemberGroupComment(10, { body: 'Member note', coachesOnly: false }))
      .resolves.toMatchObject({ ok: false })
    expect(payloadState.create).not.toHaveBeenCalled()
  })

  it('requires a resolved member session before reading private mirrors', async () => {
    memberSession.profile = null

    await expect(getMemberPortalHome()).resolves.toBeNull()
    expect(payloadState.find).not.toHaveBeenCalled()
  })
})
