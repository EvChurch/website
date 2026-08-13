import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), track: vi.fn() }))

vi.mock('@/lib/payload', () => ({
  getPayloadClient: async () => ({ auth: mocks.auth }),
}))
vi.mock('@/lib/rock-forms/server', () => ({
  listPublicRockForms: mocks.list,
}))
vi.mock('@/lib/tracked-not-found', () => ({ trackNotFound: mocks.track }))

import { GET } from './route'

const request = () =>
  new NextRequest('http://localhost/api/admin/rock-forms', {
    headers: { cookie: 'payload-token=test' },
  })

describe('Rock workflow admin discovery route', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires page edit permission and returns private data', async () => {
    mocks.auth.mockResolvedValue({
      user: { id: 1 },
      permissions: { collections: { pages: { update: true } } },
    })
    mocks.list.mockResolvedValue([{ guid: 'guid', name: 'Contact us' }])

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('private')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(await response.json()).toEqual({
      forms: [{ guid: 'guid', name: 'Contact us' }],
    })
  })

  it('fails closed without page edit permission', async () => {
    mocks.auth.mockResolvedValue({ user: null, permissions: {} })

    const response = await GET(request())

    expect(response.status).toBe(404)
    expect(mocks.track).toHaveBeenCalledWith('api', 'admin', 'rock-forms')
    expect(mocks.list).not.toHaveBeenCalled()
  })
})
