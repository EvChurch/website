import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  profile: vi.fn(), payload: { find: vi.fn(), create: vi.fn() }, detail: vi.fn(),
}))
vi.mock('@/auth/member-session', () => ({ getCurrentMemberProfile: mocks.profile }))
vi.mock('@/lib/payload', () => ({ getPayloadClient: () => mocks.payload }))
vi.mock('./data', () => ({ getMemberResourceDetail: mocks.detail }))

import { createOrReuseLeaderResourceShare, getPublicLeaderResourceShare, isLeaderResourceShareToken } from './leader-resource-sharing'

describe('leader resource sharing', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.profile.mockResolvedValue({ personId: 42 }); mocks.detail.mockResolvedValue({ access: 'granted', canAccessLeaderContent: true, resource: {} }) })

  it('validates the exact opaque token shape', () => {
    expect(isLeaderResourceShareToken('a'.repeat(32))).toBe(true)
    expect(isLeaderResourceShareToken('245-42')).toBe(false)
  })

  it('reuses the same share for an authorized leader', async () => {
    mocks.payload.find.mockResolvedValueOnce({
      docs: [{ token: 'a'.repeat(32), resourceRockId: 245, sharerRockPersonId: 42 }],
    })
    await expect(createOrReuseLeaderResourceShare(245)).resolves.toBe('a'.repeat(32))
    expect(mocks.payload.create).not.toHaveBeenCalled()
  })

  it('reuses a share for a coach without a leader membership', async () => {
    mocks.payload.find.mockResolvedValueOnce({
      docs: [{ token: 'a'.repeat(32), resourceRockId: 245, sharerRockPersonId: 42 }],
    })
    await expect(createOrReuseLeaderResourceShare(245)).resolves.toBe('a'.repeat(32))
    expect(mocks.detail).toHaveBeenCalledWith(245)
    expect(mocks.payload.create).not.toHaveBeenCalled()
  })

  it('creates the first share after the access boundary grants access', async () => {
    const share = {
      token: 'a'.repeat(32),
      resourceRockId: 245,
      sharerRockPersonId: 42,
    }
    mocks.payload.find.mockResolvedValueOnce({ docs: [] })
    mocks.payload.create.mockResolvedValueOnce(share)

    await expect(createOrReuseLeaderResourceShare(245)).resolves.toBe(share.token)
    expect(mocks.detail).toHaveBeenCalledWith(245)
    expect(mocks.payload.create).toHaveBeenCalledWith({
      collection: 'leader-resource-shares',
      overrideAccess: true,
      data: {
        token: expect.stringMatching(/^[A-Za-z0-9_-]{32}$/u),
        pairKey: '245:42',
        resourceRockId: 245,
        sharerRockPersonId: 42,
      },
    })
  })

  it('denies public sharing when an ordinary member has study-only detail access', async () => {
    mocks.detail.mockResolvedValueOnce({
      access: 'granted',
      canAccessLeaderContent: false,
      resource: { hasMemberStudy: true },
    })
    await expect(createOrReuseLeaderResourceShare(245)).resolves.toBeNull()
    expect(mocks.detail).toHaveBeenCalledWith(245)
    expect(mocks.payload.find).not.toHaveBeenCalled()
    expect(mocks.payload.create).not.toHaveBeenCalled()
  })

  it('returns current resource data and omits a removed sharer', async () => {
    mocks.payload.find
      .mockResolvedValueOnce({ docs: [{ token: 'a'.repeat(32), resourceRockId: 245, sharerRockPersonId: 42 }] })
      .mockResolvedValueOnce({ docs: [{ rockId: 245, title: 'Current title', description: 'Current copy', leaderNotesFile: { guid: 'abc', name: 'Notes.pdf' } }] })
      .mockResolvedValueOnce({ docs: [] })
    const result = await getPublicLeaderResourceShare('a'.repeat(32))
    expect(result?.resource).toMatchObject({ title: 'Current title', description: 'Current copy' })
    expect(result?.sharer).toBeNull()
  })
})
