import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  isPublished: vi.fn(),
  rockFetch: vi.fn(),
  verifyContext: vi.fn(),
}))

vi.mock('@/lib/rock-api', () => ({ rockFetch: mocks.rockFetch }))
vi.mock('@/lib/rock-forms/context-token', () => ({
  verifyRockFormContextToken: mocks.verifyContext,
}))
vi.mock('@/lib/rock-forms/published', () => ({
  isRockFormPublished: mocks.isPublished,
}))
vi.mock('@/lib/rock-connection-signups/rate-limit', () => ({
  ConnectionRateLimitError: class ConnectionRateLimitError extends Error {
    retryAfterSeconds = 60
  },
  enforceConnectionRateLimit: mocks.enforceRateLimit,
  trustedConnectionClientAddress: () => '203.0.113.1',
}))

import { ROCK_FIELD_TYPES } from '@/lib/rock-forms/field-types'
import { POST } from './route'

const workflowTypeGuid = '874418b5-a477-4382-94dc-38060b005bfa'
const routeContext = { params: Promise.resolve({ workflowTypeGuid }) }

function request(origin?: string) {
  return new NextRequest(
    `https://www.ev.church/api/rock-forms/${workflowTypeGuid}/people`,
    {
      method: 'POST',
      headers: origin
        ? { origin, 'content-type': 'application/json' }
        : { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'Ada', contextToken: 'encrypted-context' }),
    },
  )
}

describe('Rock workflow person search route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RAILWAY_PUBLIC_DOMAIN', 'www.ev.church')
    mocks.verifyContext.mockReturnValue({
      workflowTypeGuid,
      allowedFields: [{ fieldTypeGuid: ROCK_FIELD_TYPES.person }],
    })
    mocks.isPublished.mockResolvedValue(true)
    mocks.rockFetch.mockResolvedValue([])
  })

  afterEach(() => vi.unstubAllEnvs())

  it('fails closed when a production request omits Origin', async () => {
    const response = await POST(request(), routeContext)

    expect(response.status).toBe(403)
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled()
  })

  it('rate limits same-origin searches before querying Rock', async () => {
    const response = await POST(request('https://www.ev.church'), routeContext)

    expect(response.status).toBe(200)
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith({
      address: '203.0.113.1',
      routeClass: 'personSearch',
    })
    expect(mocks.rockFetch).toHaveBeenCalledOnce()
  })
})
