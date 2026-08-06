import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  beginTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  find: vi.fn(),
  getPayloadClient: vi.fn(),
  listEligible: vi.fn(),
  rockFetchAll: vi.fn(),
  rollbackTransaction: vi.fn(),
  update: vi.fn(),
  updateGlobal: vi.fn(),
}))

vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }))
vi.mock('@/lib/rock-api', () => ({ rockFetchAll: mocks.rockFetchAll }))
vi.mock('@/lib/rock-connection-signups/server', () => ({
  listEligibleRockConnectionSignups: mocks.listEligible,
}))

import { syncServiceGuideItems } from './service-guide-items'

describe('syncServiceGuideItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.beginTransaction.mockResolvedValue('service-guide-transaction')
    mocks.commitTransaction.mockResolvedValue(undefined)
    mocks.rollbackTransaction.mockResolvedValue(undefined)
    mocks.create.mockResolvedValue({})
    mocks.update.mockResolvedValue({})
    mocks.delete.mockResolvedValue({})
    mocks.updateGlobal.mockResolvedValue({})
    mocks.listEligible.mockResolvedValue([
      {
        opportunityGuid: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        blockGuid: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        label: 'Connect',
      },
    ])
    mocks.rockFetchAll.mockImplementation(({ endpoint }: { endpoint: string }) => {
      if (endpoint === 'ContentChannelItems') {
        return Promise.resolve([
          item(1, 1),
          item(2, 2, { Event: { Value: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' } }),
        ])
      }
      if (endpoint === 'Campuses') {
        return Promise.resolve([
          { Id: 10, Guid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
        ])
      }
      if (endpoint === 'EventItems') {
        return Promise.resolve([
          { Id: 20, Guid: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' },
        ])
      }
      throw new Error(`Unexpected endpoint ${endpoint}`)
    })
    mocks.find.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'campuses') return Promise.resolve({ docs: [{ id: 100, rockId: 10 }] })
      if (collection === 'events') return Promise.resolve({ docs: [{ id: 200, rockEventId: 20 }] })
      if (collection === 'service-guide-items') {
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
      updateGlobal: mocks.updateGlobal,
    })
  })

  it('resolves references and atomically reconciles a complete snapshot', async () => {
    const result = await syncServiceGuideItems()

    expect(mocks.rockFetchAll).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: 'ContentChannelItems',
      params: {
        $filter: 'ContentChannelId eq 13',
        $orderby: 'Priority desc,Order,Id',
        loadAttributes: 'simple',
      },
    }))
    expect(result).toEqual({
      entity: 'service-guide-items',
      created: 1,
      updated: 1,
      deleted: 1,
      errors: [],
    })
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'service-guide-items',
        id: 501,
        data: expect.objectContaining({
          campuses: [100],
          connectionBlockGuid: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        }),
      }),
    )
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'service-guide-items',
        data: expect.objectContaining({ event: 200 }),
      }),
    )
    expect(mocks.delete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'service-guide-items', id: 503 }),
    )
    expect(mocks.updateGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'service-guide-sync-state',
        data: expect.objectContaining({ itemCount: 2, diagnosticCount: 0 }),
      }),
    )
    expect(mocks.commitTransaction).toHaveBeenCalledWith('service-guide-transaction')
    expect(mocks.rollbackTransaction).not.toHaveBeenCalled()
  })

  it('performs no Payload work after an incomplete channel fetch', async () => {
    mocks.rockFetchAll.mockRejectedValueOnce(new Error('Rock unavailable'))

    const result = await syncServiceGuideItems()

    expect(result.errors).toEqual(['Error: Rock unavailable'])
    expect(mocks.getPayloadClient).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it('rejects an unexpected empty snapshot instead of deleting existing records', async () => {
    mocks.rockFetchAll.mockResolvedValue([])
    mocks.find.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'service-guide-items') {
        return Promise.resolve({ docs: [{ id: 503, rockId: 3 }] })
      }
      return Promise.resolve({ docs: [] })
    })

    const result = await syncServiceGuideItems()

    expect(result.errors[0]).toContain('empty Service Guide snapshot')
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(mocks.updateGlobal).not.toHaveBeenCalled()
    expect(mocks.rollbackTransaction).toHaveBeenCalledWith('service-guide-transaction')
  })

  it('rejects an implausibly short snapshot instead of deleting most mirrored records', async () => {
    mocks.rockFetchAll.mockImplementation(({ endpoint }: { endpoint: string }) => {
      if (endpoint === 'ContentChannelItems') return Promise.resolve([item(1, 1)])
      if (endpoint === 'Campuses') {
        return Promise.resolve([
          { Id: 10, Guid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
        ])
      }
      if (endpoint === 'EventItems') return Promise.resolve([])
      throw new Error(`Unexpected endpoint ${endpoint}`)
    })
    mocks.find.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'campuses') return Promise.resolve({ docs: [{ id: 100, rockId: 10 }] })
      if (collection === 'events') return Promise.resolve({ docs: [] })
      if (collection === 'service-guide-items') {
        return Promise.resolve({
          docs: Array.from({ length: 10 }, (_, index) => ({
            id: 500 + index,
            rockId: index + 1,
          })),
        })
      }
      throw new Error(`Unexpected collection ${collection}`)
    })

    const result = await syncServiceGuideItems()

    expect(result.errors[0]).toContain('implausible Service Guide snapshot drop')
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(mocks.updateGlobal).not.toHaveBeenCalled()
    expect(mocks.rollbackTransaction).toHaveBeenCalledWith('service-guide-transaction')
  })

  it('records a diagnostic for a mirrored item with no usable launcher action', async () => {
    mocks.rockFetchAll.mockImplementation(({ endpoint }: { endpoint: string }) => {
      if (endpoint === 'ContentChannelItems') {
        return Promise.resolve([
          {
            Id: 9,
            Title: 'Unavailable item',
            Content: null,
            Status: 1,
            StartDateTime: null,
            AttributeValues: {
              Campuses: { Value: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
            },
          },
        ])
      }
      if (endpoint === 'Campuses') {
        return Promise.resolve([
          { Id: 10, Guid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
        ])
      }
      if (endpoint === 'EventItems') return Promise.resolve([])
      throw new Error(`Unexpected endpoint ${endpoint}`)
    })
    mocks.find.mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'campuses') return Promise.resolve({ docs: [{ id: 100, rockId: 10 }] })
      if (collection === 'events' || collection === 'service-guide-items') {
        return Promise.resolve({ docs: [] })
      }
      throw new Error(`Unexpected collection ${collection}`)
    })

    const result = await syncServiceGuideItems()

    expect(result.errors).toEqual([])
    expect(mocks.updateGlobal).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ diagnosticCount: 1 }),
      }),
    )
  })

  it('rolls back all changes when reconciliation fails', async () => {
    mocks.create.mockRejectedValueOnce(new Error('write failed'))

    const result = await syncServiceGuideItems()

    expect(result.errors).toEqual(['Error: write failed'])
    expect(result.created).toBe(0)
    expect(result.updated).toBe(0)
    expect(result.deleted).toBe(0)
    expect(mocks.rollbackTransaction).toHaveBeenCalledWith('service-guide-transaction')
    expect(mocks.commitTransaction).not.toHaveBeenCalled()
  })
})

function item(
  Id: number,
  Order: number,
  attributes: Record<string, { Value: string }> = {},
) {
  return {
    Id,
    Title: `Item ${Id}`,
    Content: '<p>Details</p>',
    Status: 1,
    StartDateTime: '2026-08-01T00:00:00+12:00',
    Priority: 1,
    Order,
    AttributeValues: {
      Campuses: { Value: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
      ConnectionOpportunity: { Value: 'cccccccc-cccc-cccc-cccc-cccccccccccc' },
      ...attributes,
    },
  }
}
