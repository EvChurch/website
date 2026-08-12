import { describe, expect, it, vi } from 'vitest'

import { findMissingPathRedirect, recordMissingPublicPath } from './missing-paths'

function payload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockResolvedValue({ docs: [] }),
    db: { drizzle: { execute: vi.fn() } },
    logger: { error: vi.fn() },
    ...overrides,
  } as never
}

describe('missing path services', () => {
  it('looks up an exact normalized source with a narrow query', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [{ destination: '/kids' }] })
    await expect(findMissingPathRedirect('/old/', payload({ find }))).resolves.toBe('/kids')
    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'missing-paths',
      depth: 0,
      limit: 1,
      select: { destination: true },
      where: { path: { equals: '/old' } },
    }))
  })

  it('returns no destination for absent, unresolved, or ineligible paths', async () => {
    const unresolved = vi.fn().mockResolvedValue({ docs: [{ destination: null }] })
    expect(await findMissingPathRedirect('/old', payload({ find: unresolved }))).toBeNull()
    expect(await findMissingPathRedirect('/admin/missing', payload({ find: unresolved }))).toBeNull()
    expect(unresolved).toHaveBeenCalledOnce()
  })

  it('executes one atomic upsert for a confirmed unresolved path', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    await expect(recordMissingPublicPath('/old/?campaign=x', payload({
      db: { drizzle: { execute } },
    }))).resolves.toEqual({ recorded: true, path: '/old' })
    expect(execute).toHaveBeenCalledOnce()
    const query = execute.mock.calls[0]?.[0] as { queryChunks?: unknown[] }
    expect(JSON.stringify(query.queryChunks)).toContain('ON CONFLICT')
  })

  it('does not increment an ineligible path', async () => {
    const execute = vi.fn()
    await expect(recordMissingPublicPath('/api/private', payload({
      db: { drizzle: { execute } },
    }))).resolves.toEqual({ recorded: false, reason: 'ineligible' })
    expect(execute).not.toHaveBeenCalled()
  })

  it('sanitizes database failures and returns a non-throwing result', async () => {
    const error = vi.fn()
    await expect(recordMissingPublicPath('/old?secret=value', payload({
      db: { drizzle: { execute: vi.fn().mockRejectedValue(new Error('password=secret')) } },
      logger: { error },
    }))).resolves.toEqual({ recorded: false, reason: 'database', path: '/old' })
    expect(error).toHaveBeenCalledWith(expect.objectContaining({
      category: 'missing-path-write-failed',
      path: '/old',
    }))
    expect(JSON.stringify(error.mock.calls)).not.toContain('secret')
  })
})
