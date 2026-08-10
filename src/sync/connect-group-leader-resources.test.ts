import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  beginTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  find: vi.fn(),
  getPayloadClient: vi.fn(),
  rockFetchAll: vi.fn(),
  rollbackTransaction: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }))
vi.mock('@/lib/rock-api', () => ({ rockFetchAll: mocks.rockFetchAll }))

import { syncConnectGroupLeaderResources } from './connect-group-leader-resources'

const CAMPUS_GUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const HOST_ONE_GUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const HOST_TWO_GUID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

describe('syncConnectGroupLeaderResources', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.beginTransaction.mockResolvedValue('resource-transaction')
    mocks.commitTransaction.mockResolvedValue(undefined)
    mocks.rollbackTransaction.mockResolvedValue(undefined)
    mocks.create.mockResolvedValue({})
    mocks.update.mockResolvedValue({})
    mocks.delete.mockResolvedValue({})
    mocks.rockFetchAll.mockImplementation(({ endpoint, params }: FetchCall) => {
      if (endpoint === 'ContentChannelItems') {
        return Promise.resolve([
          resource(1, { campus: CAMPUS_GUID, host1: HOST_ONE_GUID }),
          resource(2, { host1: HOST_TWO_GUID, status: 3 }),
        ])
      }
      if (endpoint === 'Campuses') {
        return Promise.resolve([{ Id: 10, Guid: CAMPUS_GUID }])
      }
      if (endpoint === 'PersonAlias') {
        const hostGuid = params.$filter.includes(HOST_ONE_GUID) ? HOST_ONE_GUID : HOST_TWO_GUID
        return Promise.resolve([
          {
            Id: hostGuid === HOST_ONE_GUID ? 21 : 22,
            PersonId: hostGuid === HOST_ONE_GUID ? 31 : 32,
            Person: { Id: 31, Email: '', PhotoId: hostGuid === HOST_ONE_GUID ? 701 : 702 },
          },
        ])
      }
      throw new Error(`Unexpected endpoint ${endpoint}`)
    })
    mocks.find.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'campuses') {
        return Promise.resolve({ docs: [{ id: 100, rockId: 10 }] })
      }
      if (collection === 'connect-group-leader-resources') {
        return Promise.resolve({ docs: [{ id: 501, rockId: 1 }, { id: 503, rockId: 3 }] })
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

  it('fetches, enriches, and atomically reconciles the complete channel snapshot', async () => {
    const result = await syncConnectGroupLeaderResources()

    expect(mocks.rockFetchAll).toHaveBeenNthCalledWith(1, {
      endpoint: 'ContentChannelItems',
      getKey: expect.any(Function),
      params: {
        $filter: 'ContentChannelId eq 24',
        $orderby: 'Priority desc,Order,Id',
        loadAttributes: 'simple',
      },
    })
    expect(mocks.rockFetchAll).toHaveBeenNthCalledWith(2, {
      endpoint: 'Campuses',
      getKey: expect.any(Function),
      params: { $orderby: 'Id', $select: 'Id,Guid' },
    })
    expect(mocks.rockFetchAll.mock.calls.slice(2)).toEqual([
      [aliasRequest(HOST_ONE_GUID)],
      [aliasRequest(HOST_TWO_GUID)],
    ])
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'connect-group-leader-resources',
      limit: 0,
      pagination: false,
    }))
    expect(result).toEqual({
      entity: 'connect-group-leader-resources',
      created: 1,
      updated: 1,
      deleted: 1,
      errors: [],
    })
    expect(mocks.update).toHaveBeenCalledWith({
      collection: 'connect-group-leader-resources',
      id: 501,
      data: expect.objectContaining({
        rockId: 1,
        campuses: [100],
        campusGuids: [{ guid: CAMPUS_GUID }],
        hosts: [{ personAliasGuid: HOST_ONE_GUID, name: 'Host 1', photoId: 701 }],
        leaderNotesFile: {
          guid: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          name: 'Leader Notes.pdf',
        },
      }),
      req: { transactionID: 'resource-transaction' },
    })
    expect(mocks.delete).toHaveBeenCalledWith({
      collection: 'connect-group-leader-resources',
      id: 503,
      req: { transactionID: 'resource-transaction' },
    })
    expect(mocks.commitTransaction).toHaveBeenCalledWith('resource-transaction')
    expect(mocks.rollbackTransaction).not.toHaveBeenCalled()
  })

  it('preserves upcoming resources and every Rock status', async () => {
    await syncConnectGroupLeaderResources()

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rockId: 2,
          status: 3,
          startDateTime: '2030-01-01T00:00:00+13:00',
        }),
      }),
    )
  })

  it('treats a blank campus assignment as universal', async () => {
    mocks.rockFetchAll.mockImplementation(({ endpoint }: FetchCall) => {
      if (endpoint === 'ContentChannelItems') return Promise.resolve([resource(4)])
      if (endpoint === 'Campuses') return Promise.resolve([])
      throw new Error(`Unexpected endpoint ${endpoint}`)
    })
    mocks.find.mockResolvedValue({ docs: [] })

    const result = await syncConnectGroupLeaderResources()

    expect(result.errors).toEqual([])
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ campusGuids: [], campuses: [] }),
      }),
    )
  })

  it('normalizes absent optional file groups for Payload writes', async () => {
    const itemWithFile = resource(4)
    const { Resource1File: _resource1File, ...attributeValues } = itemWithFile.AttributeValues
    const item = { ...itemWithFile, AttributeValues: attributeValues }
    mocks.rockFetchAll.mockImplementation(({ endpoint }: FetchCall) => {
      if (endpoint === 'ContentChannelItems') return Promise.resolve([item])
      if (endpoint === 'Campuses') return Promise.resolve([])
      throw new Error(`Unexpected endpoint ${endpoint}`)
    })
    mocks.find.mockResolvedValue({ docs: [] })

    const result = await syncConnectGroupLeaderResources()

    expect(result.errors).toEqual([])
    const createData = mocks.create.mock.calls[0]?.[0]?.data
    expect(createData).toMatchObject({
      leaderNotesFile: {},
      memberStudyFile: {},
    })
  })

  it('fails before the transaction when an assigned campus GUID is unresolved', async () => {
    mocks.find.mockResolvedValue({ docs: [] })

    const result = await syncConnectGroupLeaderResources()

    expect(result.errors[0]).toContain(`unresolved campus ${CAMPUS_GUID}`)
    expect(mocks.beginTransaction).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it.each([
    ['channel', 1],
    ['campus references', 2],
    ['host references', 3],
  ])('does no Payload work when the %s fetch is incomplete', async (_label, callNumber) => {
    mocks.rockFetchAll.mockImplementationOnce(() =>
      callNumber === 1
        ? Promise.reject(new Error('remote fetch failed'))
        : Promise.resolve([resource(1, { host1: HOST_ONE_GUID })]),
    )
    if (callNumber > 1) {
      mocks.rockFetchAll.mockImplementationOnce(() =>
        callNumber === 2
          ? Promise.reject(new Error('remote fetch failed'))
          : Promise.resolve([]),
      )
    }
    if (callNumber > 2) {
      mocks.rockFetchAll.mockRejectedValueOnce(new Error('remote fetch failed'))
    }

    const result = await syncConnectGroupLeaderResources()

    expect(result.errors).toEqual(['Error: remote fetch failed'])
    expect(mocks.getPayloadClient).not.toHaveBeenCalled()
    expect(mocks.beginTransaction).not.toHaveBeenCalled()
  })

  it('rejects an empty snapshot instead of deleting existing resources', async () => {
    mocks.rockFetchAll.mockResolvedValue([])

    const result = await syncConnectGroupLeaderResources()

    expect(result.errors[0]).toContain('empty Connect Group Leader Resource snapshot')
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(mocks.rollbackTransaction).toHaveBeenCalledWith('resource-transaction')
  })

  it('rejects a snapshot drop of fifty percent', async () => {
    mocks.rockFetchAll.mockImplementation(({ endpoint }: FetchCall) => {
      if (endpoint === 'ContentChannelItems') {
        return Promise.resolve(Array.from({ length: 5 }, (_, index) => resource(index + 1)))
      }
      if (endpoint === 'Campuses') return Promise.resolve([])
      throw new Error(`Unexpected endpoint ${endpoint}`)
    })
    mocks.find.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'campuses') return Promise.resolve({ docs: [] })
      return Promise.resolve({
        docs: Array.from({ length: 10 }, (_, index) => ({ id: 500 + index, rockId: index + 1 })),
      })
    })

    const result = await syncConnectGroupLeaderResources()

    expect(result.errors[0]).toContain('implausible Connect Group Leader Resource snapshot drop')
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(mocks.rollbackTransaction).toHaveBeenCalledWith('resource-transaction')
  })

  it('requires a transaction and rolls back a failed reconciliation', async () => {
    mocks.update.mockRejectedValueOnce(new Error('write failed'))

    const failed = await syncConnectGroupLeaderResources()

    expect(failed.errors).toEqual(['Error: write failed'])
    expect(failed.created).toBe(0)
    expect(failed.updated).toBe(0)
    expect(failed.deleted).toBe(0)
    expect(mocks.rollbackTransaction).toHaveBeenCalledWith('resource-transaction')
    expect(mocks.commitTransaction).not.toHaveBeenCalled()

    vi.clearAllMocks()
    mocks.beginTransaction.mockResolvedValue(null)
    mocks.rockFetchAll.mockImplementation(({ endpoint }: FetchCall) => {
      if (endpoint === 'ContentChannelItems') return Promise.resolve([resource(4)])
      if (endpoint === 'Campuses') return Promise.resolve([])
      throw new Error(`Unexpected endpoint ${endpoint}`)
    })
    mocks.find.mockResolvedValue({ docs: [] })
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

    const withoutTransaction = await syncConnectGroupLeaderResources()

    expect(withoutTransaction.errors[0]).toContain('transactions are required')
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.commitTransaction).not.toHaveBeenCalled()
  })
})

type FetchCall = { endpoint: string; params: Record<string, string> }

function aliasRequest(guid: string) {
  return {
    endpoint: 'PersonAlias',
    getKey: expect.any(Function),
    params: {
      $expand: 'Person',
      $filter: `Guid eq guid'${guid}'`,
      $orderby: 'Id',
    },
  }
}

function resource(
  Id: number,
  options: { campus?: string; host1?: string; status?: number } = {},
) {
  return {
    Id,
    Guid: `00000000-0000-0000-0000-${String(Id).padStart(12, '0')}`,
    Title: `Resource ${Id}`,
    Content: '<p>Resource details</p>',
    Status: options.status ?? 1,
    StartDateTime: Id === 2 ? '2030-01-01T00:00:00+13:00' : '2026-08-01T00:00:00+12:00',
    ExpireDateTime: null,
    Priority: 10 - Id,
    Order: Id,
    AttributeValues: {
      Campus: { Value: options.campus ?? '' },
      ...(options.host1
        ? { Host1: { Value: options.host1, ValueFormatted: `Host ${Id}` } }
        : {}),
      Resource1File: {
        Value: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        PersistedTextValue: 'Leader Notes.pdf',
      },
    },
  }
}
