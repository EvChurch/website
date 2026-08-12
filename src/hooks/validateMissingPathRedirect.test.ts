import { APIError } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { validateMissingPathRedirect } from './validateMissingPathRedirect'

function hookArgs({
  data,
  originalDoc,
  redirects = [],
}: {
  data: Record<string, unknown>
  originalDoc?: Record<string, unknown>
  redirects?: Array<{ id: number; path: string; destination?: string | null }>
}) {
  const execute = vi.fn().mockResolvedValue(undefined)
  return {
    args: {
      data,
      operation: originalDoc ? 'update' : 'create',
      originalDoc,
      req: {
        transactionID: Promise.resolve('tx-1'),
        payload: {
          db: { sessions: { 'tx-1': { db: { execute } } } },
          find: vi.fn().mockResolvedValue({ docs: redirects }),
        },
      },
    } as never,
    execute,
  }
}

function graphHookArgs(records: Array<{ id: number; path: string; destination?: string | null }>) {
  const execute = vi.fn().mockResolvedValue(undefined)
  const find = vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
    const serialized = JSON.stringify(where)
    const docs = records.filter((record) => {
      if (serialized.includes(`\"path\":{\"equals\":\"${record.path}\"}`)) return true
      return typeof record.destination === 'string' &&
        serialized.includes(`\"destination\":{\"equals\":\"${record.destination}\"}`)
    })
    return { docs: docs.slice(0, 1) }
  })

  const args = (data: Record<string, unknown>) => ({
    data,
    operation: 'create',
    req: {
      transactionID: Promise.resolve('tx-1'),
      payload: {
        db: { sessions: { 'tx-1': { db: { execute } } } },
        find,
      },
    },
  }) as never

  return { args, find }
}

describe('validateMissingPathRedirect', () => {
  it('normalizes a valid source and destination under an advisory lock', async () => {
    const { args, execute } = hookArgs({ data: { path: '/old/', destination: '/kids/' } })
    await expect(validateMissingPathRedirect(args)).resolves.toMatchObject({
      path: '/old',
      destination: '/kids',
    })
    expect(execute).toHaveBeenCalledOnce()
  })

  it('allows clearing a destination', async () => {
    const { args } = hookArgs({
      data: { destination: '' },
      originalDoc: { path: '/old', destination: '/kids' },
    })
    await expect(validateMissingPathRedirect(args)).resolves.toMatchObject({ destination: null })
  })

  it.each([
    ['external', 'https://example.com/kids', []],
    ['self', '/old', []],
    ['chain', '/legacy', [{ id: 2, path: '/legacy', destination: '/kids' }]],
    ['loop', '/middle', [{ id: 2, path: '/middle', destination: '/old' }]],
    ['multi-hop loop', '/one', [
      { id: 2, path: '/one', destination: '/two' },
      { id: 3, path: '/two', destination: '/old' },
    ]],
  ])('rejects a %s destination', async (_label, destination, redirects) => {
    const { args } = hookArgs({ data: { path: '/old', destination }, redirects })
    await expect(validateMissingPathRedirect(args)).rejects.toBeInstanceOf(APIError)
  })

  it('fails closed when no transaction session is available', async () => {
    const { args } = hookArgs({ data: { path: '/old', destination: '/kids' } })
    ;(args as { req: { transactionID: Promise<undefined> } }).req.transactionID = Promise.resolve(undefined)
    await expect(validateMissingPathRedirect(args)).rejects.toMatchObject({ status: 503 })
  })

  it('rejects a reverse-edge chain across sequential saves under validation', async () => {
    const records: Array<{ id: number; path: string; destination?: string | null }> = []
    const { args } = graphHookArgs(records)

    const first = await validateMissingPathRedirect(args({
      path: '/old',
      destination: '/middle',
    }))
    records.push({ id: 1, ...first } as never)

    await expect(validateMissingPathRedirect(args({
      path: '/middle',
      destination: '/new',
    }))).rejects.toBeInstanceOf(APIError)
  })
})
