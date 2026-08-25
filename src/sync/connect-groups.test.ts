import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  beginTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  fetchActiveGroupMembers: vi.fn(),
  find: vi.fn(),
  getPayloadClient: vi.fn(),
  rockFetchAll: vi.fn(),
  rollbackTransaction: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }))
vi.mock('@/lib/rock-api', () => ({ rockFetchAll: mocks.rockFetchAll }))
vi.mock('./rock-group-members', () => ({
  fetchActiveGroupMembers: mocks.fetchActiveGroupMembers,
}))

import {
  CONNECT_GROUP_COACH_SECURITY_GROUP_ID,
  syncConnectGroups,
} from './connect-groups'

describe('syncConnectGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.beginTransaction.mockResolvedValue('connect-group-transaction')
    mocks.commitTransaction.mockResolvedValue(undefined)
    mocks.rollbackTransaction.mockResolvedValue(undefined)
    mocks.create.mockResolvedValue({})
    mocks.update.mockResolvedValue({})
    mocks.delete.mockResolvedValue({})
    mockRockGroups([group(1, 'North Group', 10)])
    mocks.fetchActiveGroupMembers.mockImplementation((groupId: number) => {
      if (groupId === 1) {
        return Promise.resolve([
          membership(301, 1, 101, 'Facilitator', true, 'Alex Leader'),
          membership(302, 1, 102, 'Leader', false, 'Blair Member'),
        ])
      }
      if (groupId === CONNECT_GROUP_COACH_SECURITY_GROUP_ID) {
        return Promise.resolve([
          membership(401, groupId, 101, 'Member', false, 'Alex Leader'),
          membership(402, groupId, 103, 'Member', false, 'Casey Coach'),
        ])
      }
      throw new Error(`Unexpected group ${groupId}`)
    })
    mocks.find.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'campuses') return Promise.resolve({ docs: [{ id: 100, rockId: 10 }] })
      if (collection === 'connect-groups') {
        return Promise.resolve({ docs: [{ id: 501, rockGroupId: 1 }, { id: 599, rockGroupId: 99 }] })
      }
      if (collection === 'connect-group-participants') {
        return Promise.resolve({
          docs: [{ id: 601, rockPersonId: 101 }, { id: 604, rockPersonId: 104 }],
        })
      }
      throw new Error(`Unexpected collection ${collection}`)
    })
    mocks.getPayloadClient.mockResolvedValue({
      create: mocks.create,
      db: {
        beginTransaction: mocks.beginTransaction,
        commitTransaction: mocks.commitTransaction,
        rollbackTransaction: mocks.rollbackTransaction,
      },
      delete: mocks.delete,
      find: mocks.find,
      update: mocks.update,
    })
  })

  it('prepares the complete snapshot then atomically reconciles groups and participants', async () => {
    const result = await syncConnectGroups()

    expect(mocks.rockFetchAll).toHaveBeenCalledWith({
      endpoint: 'Groups',
      getKey: expect.any(Function),
      params: {
        $filter: '(GroupTypeId eq 25 or GroupTypeId eq 46) and IsActive eq true',
        $expand: 'GroupLocations,Campus',
        $orderby: 'Name,Id',
      },
    })
    expect(mocks.rockFetchAll).toHaveBeenCalledWith({
      endpoint: 'Schedules',
      getKey: expect.any(Function),
      params: {
        $filter: 'Id eq 101',
        $orderby: 'Id',
        $select:
          'Id,Description,FriendlyScheduleText,IsActive,WeeklyDayOfWeek,WeeklyTimeOfDay',
      },
    })
    expect(mocks.rockFetchAll).toHaveBeenCalledWith({
      endpoint: 'Groups',
      getKey: expect.any(Function),
      params: {
        $filter: '(ParentGroupId eq 28241 or ParentGroupId eq 28781 or ParentGroupId eq 28782) and GroupTypeId eq 23 and IsActive eq true',
        $orderby: 'Name,Id',
      },
    })
    expect(mocks.fetchActiveGroupMembers.mock.calls.map(([id]) => id)).toEqual([
      1,
      CONNECT_GROUP_COACH_SECURITY_GROUP_ID,
    ])
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'connect-groups',
      limit: 0,
      pagination: false,
    }))
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'connect-group-participants',
      limit: 0,
      pagination: false,
    }))
    expect(result).toEqual({
      entity: 'connect-groups',
      created: 2,
      updated: 2,
      deleted: 2,
      errors: [],
    })

    const transactionRequest = { transactionID: 'connect-group-transaction' }
    expect(mocks.update).toHaveBeenCalledWith({
      collection: 'connect-groups',
      id: 501,
      data: expect.objectContaining({
        rockGroupId: 1,
        rockGroupGuid: '00000000-0000-4000-8000-000000000001',
        scheduleText: 'Tuesday at 7:00 PM',
        campus: 100,
        leaders: [{ name: 'Alex Leader', email: 'person101@example.com', photoId: null }],
      }),
      req: transactionRequest,
    })
    expect(mocks.update).toHaveBeenCalledWith({
      collection: 'connect-group-participants',
      id: 601,
      data: expect.objectContaining({
        rockPersonId: 101,
        isCoach: true,
        memberships: [expect.objectContaining({ rockGroupId: 1, isLeader: true })],
      }),
      req: transactionRequest,
    })
    expect(mocks.create).toHaveBeenCalledWith({
      collection: 'connect-group-participants',
      data: expect.objectContaining({
        rockPersonId: 103,
        isCoach: true,
        memberships: [],
      }),
      req: transactionRequest,
    })
    expect(mocks.delete).toHaveBeenCalledWith({
      collection: 'connect-groups',
      id: 599,
      req: transactionRequest,
    })
    expect(mocks.delete).toHaveBeenCalledWith({
      collection: 'connect-group-participants',
      id: 604,
      req: transactionRequest,
    })
    expect(mocks.commitTransaction).toHaveBeenCalledWith('connect-group-transaction')
    expect(mocks.rollbackTransaction).not.toHaveBeenCalled()
  })

  it('fetches group and coach memberships sequentially', async () => {
    mockRockGroups([
      group(1, 'First Group'),
      group(2, 'Second Group'),
    ])
    let activeFetches = 0
    let maxActiveFetches = 0
    mocks.fetchActiveGroupMembers.mockImplementation(async (groupId: number) => {
      activeFetches++
      maxActiveFetches = Math.max(maxActiveFetches, activeFetches)
      await new Promise((resolve) => setTimeout(resolve, 0))
      activeFetches--
      return groupId === CONNECT_GROUP_COACH_SECURITY_GROUP_ID
        ? []
        : [membership(300 + groupId, groupId, 100 + groupId, 'Member', false, `Person ${groupId}`)]
    })

    await syncConnectGroups()

    expect(maxActiveFetches).toBe(1)
    expect(mocks.fetchActiveGroupMembers.mock.calls.map(([id]) => id)).toEqual([
      1,
      2,
      CONNECT_GROUP_COACH_SECURITY_GROUP_ID,
    ])
  })

  it('batches schedule filters below Rock OData node limits', async () => {
    mockRockGroups(
      Array.from({ length: 26 }, (_, index) => group(index + 1, `Group ${index + 1}`)),
    )
    mocks.fetchActiveGroupMembers.mockResolvedValue([])

    await syncConnectGroups()

    const scheduleCalls = mocks.rockFetchAll.mock.calls.filter(
      ([{ endpoint }]) => endpoint === 'Schedules',
    )
    expect(scheduleCalls).toHaveLength(2)
    expect(scheduleCalls[0][0].params.$filter.split(' or ')).toHaveLength(25)
    expect(scheduleCalls[1][0].params.$filter).toBe('Id eq 126')
  })

  it('maps groups led by coaching-group members to that coaching group leaders', async () => {
    mockRockGroups(
      [
        group(1, 'Tuesday Central Connect'),
        group(2, 'Thursday Central Connect'),
      ],
      [group(90, "Alex's Coaching Group")],
    )
    mocks.fetchActiveGroupMembers.mockImplementation((groupId: number) => {
      if (groupId === 1) {
        return Promise.resolve([
          membership(301, 1, 101, 'Leader', true, 'Alex Coach'),
        ])
      }
      if (groupId === 2) {
        return Promise.resolve([
          membership(302, 2, 102, 'Leader', true, 'Blair Leader'),
        ])
      }
      if (groupId === CONNECT_GROUP_COACH_SECURITY_GROUP_ID) {
        return Promise.resolve([
          membership(401, groupId, 101, 'Member', false, 'Alex Coach'),
        ])
      }
      if (groupId === 90) {
        return Promise.resolve([
          membership(501, 90, 101, 'Coach', true, 'Alex Coach'),
          membership(502, 90, 102, 'Member', false, 'Blair Leader'),
        ])
      }
      throw new Error(`Unexpected group ${groupId}`)
    })

    await syncConnectGroups()

    expect(mocks.fetchActiveGroupMembers.mock.calls.map(([id]) => id)).toEqual([
      1,
      2,
      CONNECT_GROUP_COACH_SECURITY_GROUP_ID,
      90,
    ])
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'connect-group-participants',
      id: 601,
      data: expect.objectContaining({
        rockPersonId: 101,
        coachedGroups: [
          { rockGroupId: 1 },
          { rockGroupId: 2 },
        ],
      }),
    }))
  })

  it('fails before the transaction when an assigned campus is not mirrored', async () => {
    mocks.find.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'campuses') return Promise.resolve({ docs: [] })
      throw new Error(`Unexpected collection ${collection}`)
    })

    const result = await syncConnectGroups()

    expect(result.errors[0]).toContain('campus 10')
    expect(mocks.beginTransaction).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it.each([
    ['group list', () => mocks.rockFetchAll.mockRejectedValueOnce(new Error('groups failed'))],
    ['one group membership', () => mocks.fetchActiveGroupMembers.mockRejectedValueOnce(new Error('members failed'))],
    ['coach membership', () => mocks.fetchActiveGroupMembers.mockRejectedValueOnce(new Error('coaches failed'))],
  ])('leaves Payload untouched when the %s fetch is incomplete', async (_label, fail) => {
    if (_label === 'coach membership') {
      mocks.fetchActiveGroupMembers.mockImplementation((groupId: number) => {
        if (groupId === CONNECT_GROUP_COACH_SECURITY_GROUP_ID) {
          return Promise.reject(new Error('coaches failed'))
        }
        return Promise.resolve([])
      })
    } else {
      fail()
    }

    const result = await syncConnectGroups()

    expect(result.errors[0]).toMatch(/failed/)
    expect(mocks.getPayloadClient).not.toHaveBeenCalled()
    expect(mocks.beginTransaction).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it('leaves Payload untouched when a coaching-group membership fetch fails', async () => {
    mockRockGroups(
      [group(1, 'Tuesday Central Connect')],
      [group(90, "Alex's Coaching Group")],
    )
    mocks.fetchActiveGroupMembers.mockImplementation((groupId: number) => {
      if (groupId === 90) return Promise.reject(new Error('coaching group members failed'))
      return Promise.resolve([])
    })

    const result = await syncConnectGroups()

    expect(result.errors).toEqual(['Error: coaching group members failed'])
    expect(mocks.getPayloadClient).not.toHaveBeenCalled()
    expect(mocks.beginTransaction).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it('rejects incomplete durable membership identifiers before Payload access', async () => {
    mocks.fetchActiveGroupMembers.mockImplementation((groupId: number) => {
      if (groupId === CONNECT_GROUP_COACH_SECURITY_GROUP_ID) return Promise.resolve([])
      return Promise.resolve([{ ...membership(301, 1, 101, 'Member', false, 'Alex'), Id: undefined }])
    })

    const result = await syncConnectGroups()

    expect(result.errors[0]).toContain('durable Id')
    expect(mocks.getPayloadClient).not.toHaveBeenCalled()
  })

  it('rejects an empty snapshot instead of deleting existing mirrors', async () => {
    mockRockGroups([])
    mocks.fetchActiveGroupMembers.mockResolvedValue([])

    const result = await syncConnectGroups()

    expect(result.errors[0]).toContain('empty Connect Group snapshot')
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(mocks.rollbackTransaction).toHaveBeenCalledWith('connect-group-transaction')
  })

  it('rejects an implausibly short snapshot instead of deleting most mirrors', async () => {
    mocks.find.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'campuses') return Promise.resolve({ docs: [{ id: 100, rockId: 10 }] })
      if (collection === 'connect-groups') {
        return Promise.resolve({
          docs: Array.from({ length: 10 }, (_, index) => ({ id: 500 + index, rockGroupId: index + 1 })),
        })
      }
      if (collection === 'connect-group-participants') return Promise.resolve({ docs: [] })
      throw new Error(`Unexpected collection ${collection}`)
    })

    const result = await syncConnectGroups()

    expect(result.errors[0]).toContain('implausible Connect Group snapshot drop')
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(mocks.rollbackTransaction).toHaveBeenCalledWith('connect-group-transaction')
  })

  it('refuses to reconcile when Payload cannot provide a transaction', async () => {
    mocks.beginTransaction.mockResolvedValue(null)

    const result = await syncConnectGroups()

    expect(result.errors[0]).toContain('transactions are required')
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(mocks.commitTransaction).not.toHaveBeenCalled()
    expect(mocks.rollbackTransaction).not.toHaveBeenCalled()
  })

  it('rolls back both collection reconciliations when a write fails', async () => {
    mocks.create.mockRejectedValueOnce(new Error('participant write failed'))

    const result = await syncConnectGroups()

    expect(result.errors).toEqual(['Error: participant write failed'])
    expect(result).toMatchObject({ created: 0, updated: 0, deleted: 0 })
    expect(mocks.rollbackTransaction).toHaveBeenCalledWith('connect-group-transaction')
    expect(mocks.commitTransaction).not.toHaveBeenCalled()
  })
})

function mockRockGroups(
  connectGroups: ReturnType<typeof group>[],
  coachingGroups: ReturnType<typeof group>[] = [],
) {
  mocks.rockFetchAll.mockImplementation(
    ({ endpoint, params }: { endpoint: string; params: { $filter: string } }) => {
      if (endpoint === 'Schedules') {
        return Promise.resolve(
          connectGroups.map((connectGroup) => ({
            Id: connectGroup.ScheduleId,
            Description: 'Tuesday at 7:00 PM',
            FriendlyScheduleText: 'Tuesday at 7:00 PM',
            IsActive: true,
            WeeklyDayOfWeek: 2,
            WeeklyTimeOfDay: '19:00:00',
          })),
        )
      }
      return Promise.resolve(
        params.$filter.includes('ParentGroupId eq') ? coachingGroups : connectGroups,
      )
    },
  )
}

function group(
  Id: number,
  Name: string,
  CampusId: number | null = null,
  ParentGroupId: number | null = null,
) {
  return {
    Id,
    Guid: `00000000-0000-4000-8000-${String(Id).padStart(12, '0')}`,
    Name,
    Description: '',
    IsActive: true,
    GroupCapacity: null,
    CampusId,
    ScheduleId: Id + 100,
    ParentGroupId,
    GroupLocations: [],
  }
}

function membership(
  Id: number,
  GroupId: number,
  personId: number,
  roleName: string,
  isLeader: boolean,
  fullName: string,
) {
  return {
    Id,
    GroupId,
    GroupRoleId: 501,
    Person: {
      Id: personId,
      FullName: fullName,
      Email: `person${personId}@example.com`,
      PhoneNumbers: [{ NumberFormatted: `021 ${personId}` }],
    },
    GroupRole: { Id: 501, Name: roleName, IsLeader: isLeader },
    GroupOrder: 1,
  }
}
