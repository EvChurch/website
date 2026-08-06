import { describe, expect, it, vi } from 'vitest'

import { protectLastAdminDelete, protectLastAdminUpdate } from './protectLastAdmin'

function requestHarness(adminCount: number) {
  const execute = vi.fn().mockResolvedValue(undefined)
  const count = vi.fn().mockResolvedValue({ totalDocs: adminCount })
  const request = {
    transactionID: 1,
    payload: {
      db: { sessions: { 1: { db: { execute } } } },
      count,
    },
  } as never
  return { count, execute, request }
}

function req(adminCount: number) {
  return requestHarness(adminCount).request
}

describe('last administrator protection', () => {
  it('blocks removing the final admin role', async () => {
    await expect(
      protectLastAdminUpdate({
        data: { roles: [] },
        originalDoc: { roles: ['admin'] },
        operation: 'update',
        req: req(1),
      } as never),
    ).rejects.toThrow('final Payload administrator')
  })

  it('allows demotion when another admin remains', async () => {
    const data = { roles: ['editor'] }
    const { count, execute, request } = requestHarness(2)
    await expect(
      protectLastAdminUpdate({
        data,
        originalDoc: { roles: ['admin'] },
        operation: 'update',
        req: request,
      } as never),
    ).resolves.toBe(data)
    expect(execute).toHaveBeenCalledOnce()
    expect(execute.mock.invocationCallOrder[0]).toBeLessThan(
      count.mock.invocationCallOrder[0],
    )
  })

  it('blocks clearing the final admin role with null', async () => {
    await expect(
      protectLastAdminUpdate({
        data: { roles: null },
        originalDoc: { roles: ['admin'] },
        operation: 'update',
        req: req(1),
      } as never),
    ).rejects.toThrow('final Payload administrator')
  })

  it('blocks deleting the final admin user', async () => {
    await expect(
      protectLastAdminDelete({
        id: 1,
        req: {
          transactionID: 1,
          payload: {
            db: {
              sessions: {
                1: { db: { execute: vi.fn().mockResolvedValue(undefined) } },
              },
            },
            findByID: vi.fn().mockResolvedValue({ roles: ['admin'] }),
            count: vi.fn().mockResolvedValue({ totalDocs: 1 }),
          },
        },
      } as never),
    ).rejects.toThrow('final Payload administrator')
  })

  it('fails closed when the transaction session is unavailable', async () => {
    await expect(
      protectLastAdminUpdate({
        data: { roles: [] },
        originalDoc: { roles: ['admin'] },
        operation: 'update',
        req: {
          payload: { db: {}, count: vi.fn() },
        },
      } as never),
    ).rejects.toThrow('role protection is unavailable')
  })
})
