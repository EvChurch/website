import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const revalidateTag = vi.hoisted(() => vi.fn())

vi.mock('next/cache', () => ({ revalidateTag }))

import { POST } from './route'

function request(body: unknown, token = 'cache-secret') {
  return new NextRequest('https://www.ev.church/api/internal/cache/revalidate', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('internal cache revalidation route', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'cache-secret')
    vi.clearAllMocks()
  })

  afterEach(() => vi.unstubAllEnvs())

  it('rejects missing or invalid credentials without revalidating', async () => {
    const response = await POST(request({ tags: ['events'] }, 'wrong-secret'))

    expect(response.status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('rejects tags outside the public cache tag whitelist', async () => {
    const response = await POST(request({ tags: ['events', 'arbitrary-tag'] }))

    expect(response.status).toBe(400)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('deduplicates and immediately expires valid tags', async () => {
    const response = await POST(request({ tags: ['events', 'daily-bible-readings', 'events'] }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      revalidated: ['events', 'daily-bible-readings'],
    })
    expect(revalidateTag).toHaveBeenCalledTimes(2)
    expect(revalidateTag).toHaveBeenNthCalledWith(1, 'events', { expire: 0 })
    expect(revalidateTag).toHaveBeenNthCalledWith(2, 'daily-bible-readings', { expire: 0 })
  })
})
