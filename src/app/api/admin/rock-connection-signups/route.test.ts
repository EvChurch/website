import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  list: vi.fn(),
}))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: async () => ({ auth: mocks.auth }),
}))

vi.mock('@/lib/rock-connection-signups/server', () => ({
  listEligibleRockConnectionSignups: mocks.list,
}))

import { GET } from './route'

function request() {
  return new NextRequest(
    'http://localhost/api/admin/rock-connection-signups',
    { headers: { cookie: 'payload-token=test' } },
  )
}

describe('Rock connection signup admin discovery route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires effective page edit permission and returns private normalized data', async () => {
    mocks.auth.mockResolvedValue({
      user: { id: 1 },
      permissions: { collections: { pages: { update: true } } },
    })
    mocks.list.mockResolvedValue([
      { blockGuid: '495cda8e-60fe-4f77-a452-932b460fb44c', label: 'Newish' },
    ])

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('private')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(await response.json()).toEqual({
      configurations: [
        { blockGuid: '495cda8e-60fe-4f77-a452-932b460fb44c', label: 'Newish' },
      ],
    })
    expect(mocks.list).toHaveBeenCalledOnce()
  })

  it.each([
    ['anonymous', { user: null, permissions: {} }],
    ['read-only', { user: { id: 1 }, permissions: { collections: { pages: { read: true } } } }],
  ])('denies %s requests without querying Rock', async (_name, authResult) => {
    mocks.auth.mockResolvedValue(authResult)
    const response = await GET(request())

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Not found' })
    expect(mocks.list).not.toHaveBeenCalled()
  })

  it('fails closed when authentication expires', async () => {
    mocks.auth.mockRejectedValue(new Error('expired'))
    const response = await GET(request())
    expect(response.status).toBe(404)
    expect(mocks.list).not.toHaveBeenCalled()
  })

  it('returns a safe private upstream error to an authorized editor', async () => {
    mocks.auth.mockResolvedValue({
      user: { id: 1 },
      permissions: { collections: { pages: { update: true } } },
    })
    mocks.list.mockRejectedValue(new Error('Rock secret response'))

    const response = await GET(request())
    expect(response.status).toBe(502)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(await response.json()).toEqual({
      error: 'Unable to load Rock connection signup configurations',
    })
  })
})
