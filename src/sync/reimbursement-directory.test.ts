import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  beginTransaction: vi.fn(), commitTransaction: vi.fn(), rollbackTransaction: vi.fn(),
  create: vi.fn(), update: vi.fn(), delete: vi.fn(), find: vi.fn(),
  rockFetchAll: vi.fn(), getPayloadClient: vi.fn(),
}))
vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }))
vi.mock('@/lib/rock-api', () => ({ rockFetchAll: mocks.rockFetchAll }))

import { ResponsibilityCentres } from '@/collections/ResponsibilityCentres'
import { ReimbursementFinanceMembers } from '@/collections/ReimbursementFinanceMembers'
import { REIMBURSEMENT_FINANCE_GROUPS, syncReimbursementDirectory } from './reimbursement-directory'

const aliasGuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const centre = {
  Id: 1453, DefinedTypeId: 123, Guid: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  Value: 'Magnification', Order: 1, IsActive: true,
  AttributeValues: { Supervisor: { Value: aliasGuid } },
}
const person = { Id: 30, NickName: 'Example', LastName: 'Person', Email: 'example@example.com' }
const group = (id: number, guid: string) => ({
  Id: id, Guid: guid, Name: `Finance ${id}`, IsActive: true, IsArchived: false, IsSecurityRole: true,
})
const membership = {
  Id: 50, GroupId: 18, PersonId: person.Id, GroupMemberStatus: 1, IsArchived: false, Person: person,
}
let sourceCentres: unknown[]
let sourceMembers: unknown[]
let sourceGroups: ReturnType<typeof group>[]

beforeEach(() => {
  vi.clearAllMocks()
  sourceCentres = [structuredClone(centre)]
  sourceMembers = [structuredClone(membership)]
  sourceGroups = REIMBURSEMENT_FINANCE_GROUPS.map(({ id, guid }) => group(id, guid))
  mocks.beginTransaction.mockResolvedValue('directory-transaction')
  mocks.commitTransaction.mockResolvedValue(undefined)
  mocks.rollbackTransaction.mockResolvedValue(undefined)
  mocks.create.mockResolvedValue({})
  mocks.update.mockResolvedValue({})
  mocks.delete.mockResolvedValue({})
  mocks.getPayloadClient.mockResolvedValue({
    db: {
      beginTransaction: mocks.beginTransaction, commitTransaction: mocks.commitTransaction,
      rollbackTransaction: mocks.rollbackTransaction,
    },
    create: mocks.create, update: mocks.update, delete: mocks.delete, find: mocks.find,
  })
  mocks.find.mockImplementation(async ({ collection }: { collection: string }) => ({
    docs: collection === 'responsibility-centres'
      ? [{ id: 1, rockId: 1453 }, { id: 2, rockId: 999 }]
      : [{ id: 3, rockMembershipId: 49 }],
  }))
  mocks.rockFetchAll.mockImplementation(async ({ endpoint, params }: {
    endpoint: string; params: Record<string, string>
  }) => {
    if (endpoint === 'DefinedValues') return sourceCentres
    if (endpoint === 'Groups') return sourceGroups
    if (endpoint === 'PersonAlias') return [{ Id: 20, Guid: aliasGuid, PersonId: person.Id, Person: person }]
    if (endpoint === 'GroupMembers') return params.$filter.startsWith('GroupId eq 18 ') ? sourceMembers : []
    throw new Error(`Unexpected endpoint ${endpoint}`)
  })
})

describe('reimbursement directory sync', () => {
  it('resolves supervisor aliases to person IDs, preserves removed centres and revokes removed finance members atomically', async () => {
    expect(await syncReimbursementDirectory()).toEqual({
      entity: 'reimbursement-directory', created: 1, updated: 2, deleted: 1, errors: [],
    })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'responsibility-centres', id: 1,
      data: expect.objectContaining({ approverRockPersonId: 30, approverName: 'Example Person' }),
    }))
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'responsibility-centres', id: 2,
      data: expect.objectContaining({ isActive: false, approverRockPersonId: null }),
    }))
    expect(mocks.delete).toHaveBeenCalledWith({
      collection: 'reimbursement-finance-members', id: 3, req: { transactionID: 'directory-transaction' },
    })
    expect(mocks.commitTransaction).toHaveBeenCalledOnce()
    expect(mocks.rockFetchAll.mock.invocationCallOrder.at(-1)!).toBeLessThan(
      mocks.getPayloadClient.mock.invocationCallOrder[0],
    )
  })

  it('replaces current approver assignments without retaining the previous person', async () => {
    sourceCentres = [{ ...centre, AttributeValues: { Supervisor: { Value: '' } } }]
    await syncReimbursementDirectory()
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      id: 1, data: expect.objectContaining({
        approverPersonAliasGuid: null, approverRockPersonId: null, approverName: null, approverEmail: null,
      }),
    }))
  })

  it('revokes all finance memberships when verified security roles have no active members', async () => {
    sourceMembers = []
    const result = await syncReimbursementDirectory()
    expect(result.errors).toEqual([])
    expect(result.deleted).toBe(1)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('revokes finance membership when its source security group is disabled', async () => {
    sourceGroups[0].IsActive = false
    await syncReimbursementDirectory()
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.delete).toHaveBeenCalledOnce()
  })

  it.each(['source failure', 'bad supervisor', 'missing role', 'wrong person'])('does not mutate the mirror on %s', async scenario => {
    if (scenario === 'source failure') mocks.rockFetchAll.mockRejectedValue(new Error('Rock unavailable'))
    if (scenario === 'bad supervisor') sourceCentres = [{ ...centre, AttributeValues: { Supervisor: { Value: 'invalid' } } }]
    if (scenario === 'missing role') sourceGroups = []
    if (scenario === 'wrong person') sourceMembers = [{ ...membership, PersonId: 900 }]
    const result = await syncReimbursementDirectory()
    expect(result.errors).toHaveLength(1)
    expect(mocks.getPayloadClient).not.toHaveBeenCalled()
  })

  it('retains the snapshot when Rock unexpectedly returns no centres', async () => {
    sourceCentres = []
    const result = await syncReimbursementDirectory()
    expect(result.errors[0]).toContain('empty responsibility centre snapshot')
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.delete).not.toHaveBeenCalled()
    expect(mocks.rollbackTransaction).toHaveBeenCalledOnce()
  })

  it('rolls back both mirrors if any write fails, reporting no committed changes', async () => {
    mocks.create.mockRejectedValueOnce(new Error('write failed'))
    expect(await syncReimbursementDirectory()).toMatchObject({
      created: 0, updated: 0, deleted: 0, errors: ['Error: write failed'],
    })
    expect(mocks.rollbackTransaction).toHaveBeenCalledOnce()
    expect(mocks.commitTransaction).not.toHaveBeenCalled()
  })

  it('does not count retained historical centres as a source snapshot drop', async () => {
    mocks.find.mockImplementation(async ({ collection }: { collection: string }) => ({
      docs: collection === 'responsibility-centres'
        ? Array.from({ length: 20 }, (_, i) => ({ id: i + 1, rockId: 100 + i, isActive: i < 6 }))
        : [],
    }))
    sourceCentres = Array.from({ length: 5 }, (_, i) => ({
      ...centre, Id: 100 + i,
      Guid: `bbbbbbbb-bbbb-bbbb-bbbb-${String(i).padStart(12, '0')}`,
    }))
    expect((await syncReimbursementDirectory()).errors).toEqual([])
    expect(mocks.commitTransaction).toHaveBeenCalledOnce()
  })

  it('rejects inactive memberships even if Rock ignores the status filter', async () => {
    sourceMembers = [{ ...membership, GroupMemberStatus: 0 }]
    expect((await syncReimbursementDirectory()).errors[0]).toContain('Invalid Rock finance membership')
    expect(mocks.getPayloadClient).not.toHaveBeenCalled()
  })

  it('requires transactional storage', async () => {
    mocks.beginTransaction.mockResolvedValue(null)
    const result = await syncReimbursementDirectory()
    expect(result.errors[0]).toContain('requires database transactions')
    expect(mocks.find).not.toHaveBeenCalled()
  })

  it('keeps both mirrors private and denies request-scoped writes', () => {
    for (const collection of [ResponsibilityCentres, ReimbursementFinanceMembers]) {
      const req = { user: null } as never
      expect(collection.access?.read?.({ req })).toBe(false)
      expect(collection.access?.create?.({ req })).toBe(false)
      expect(collection.access?.update?.({ req })).toBe(false)
      expect(collection.access?.delete?.({ req })).toBe(false)
    }
  })
})
