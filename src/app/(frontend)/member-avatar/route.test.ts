import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  profile: null as null | {
    personId: number
    name: string
    email: string
    photoUrl: string | null
  },
}))
const fetchMemberRockAvatar = vi.hoisted(() => vi.fn())
const getCurrentMemberProfile = vi.hoisted(() =>
  vi.fn(async () => state.profile),
)

vi.mock('@/auth/member-session', () => ({
  getCurrentMemberProfile,
}))
vi.mock('@/auth/member-rock-avatar', () => ({ fetchMemberRockAvatar }))

import { GET } from './route'

describe('member avatar route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.profile = null
  })

  it('does not contact Rock without a resolved member photo', async () => {
    const noSession = await GET()

    state.profile = {
      personId: 42,
      name: 'Alex Member',
      email: 'alex@example.com',
      photoUrl: null,
    }
    const noPhoto = await GET()

    expect(noSession.status).toBe(404)
    expect(noPhoto.status).toBe(404)
    expect(fetchMemberRockAvatar).not.toHaveBeenCalled()
  })

  it('returns a valid member image with private security headers', async () => {
    state.profile = {
      personId: 42,
      name: 'Alex Member',
      email: 'alex@example.com',
      photoUrl: '/GetImage.ashx?id=42',
    }
    fetchMemberRockAvatar.mockResolvedValue({
      body: new Uint8Array([1, 2, 3]),
      contentType: 'image/webp',
    })

    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/webp')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    )
    expect(fetchMemberRockAvatar).toHaveBeenCalledWith(
      '/GetImage.ashx?id=42',
    )
    expect(getCurrentMemberProfile).toHaveBeenCalledWith({
      persistLegacyProfile: true,
    })
  })

  it('fails safely without ending the member session when the image is unusable', async () => {
    state.profile = {
      personId: 42,
      name: 'Alex Member',
      email: 'alex@example.com',
      photoUrl: '/GetImage.ashx?id=42',
    }
    fetchMemberRockAvatar.mockResolvedValue(null)

    const response = await GET()

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })
})
