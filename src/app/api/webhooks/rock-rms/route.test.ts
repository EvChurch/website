import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const revalidateTag = vi.hoisted(() => vi.fn())

vi.mock('next/cache', () => ({ revalidateTag }))

describe('Rock webhook route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => vi.unstubAllEnvs())

  it('acknowledges a webhook without invalidating pre-sync cache data', async () => {
    const { POST } = await import('./route')
    const request = new NextRequest('https://www.ev.church/api/webhooks/rock-rms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        entityType: 'EventItem',
        entityId: 42,
        operation: 'Updated',
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      entityType: 'EventItem',
      entityId: 42,
      operation: 'Updated',
      revalidated: null,
    })
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('preserves shared-secret authentication', async () => {
    vi.stubEnv('ROCK_WEBHOOK_SECRET', 'webhook-secret')
    const { POST } = await import('./route')
    const request = new NextRequest('https://www.ev.church/api/webhooks/rock-rms', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-rock-webhook-secret': 'wrong-secret',
      },
      body: JSON.stringify({
        entityType: 'EventItem',
        entityId: 42,
        operation: 'Updated',
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
