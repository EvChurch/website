import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  profile: vi.fn(), payload: { find: vi.fn(), create: vi.fn() }, detail: vi.fn(),
}))
vi.mock('@/auth/member-session', () => ({ getCurrentMemberProfile: mocks.profile }))
vi.mock('@/lib/payload', () => ({ getPayloadClient: () => mocks.payload }))
vi.mock('./data', () => ({ getMemberResourceDetail: mocks.detail }))

import { createOrReuseLeaderResourceShare, getPublicLeaderResourceShare, isLeaderResourceShareToken } from './leader-resource-sharing'

describe('leader resource sharing', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.profile.mockResolvedValue({ personId: 42 }); mocks.detail.mockResolvedValue({ access: 'granted', resource: {} }) })

  it('validates the exact opaque token shape', () => {
    expect(isLeaderResourceShareToken('a'.repeat(32))).toBe(true)
    expect(isLeaderResourceShareToken('245-42')).toBe(false)
  })

  it('reuses the same share for an authorized leader', async () => {
    mocks.payload.find
      .mockResolvedValueOnce({ docs: [{ memberships: [{ isLeader: true }] }] })
      .mockResolvedValueOnce({ docs: [{ token: 'a'.repeat(32), resourceRockId: 245, sharerRockPersonId: 42 }] })
    await expect(createOrReuseLeaderResourceShare(245)).resolves.toBe('a'.repeat(32))
    expect(mocks.payload.create).not.toHaveBeenCalled()
  })

  it('denies a participant without leader access', async () => {
    mocks.payload.find.mockResolvedValueOnce({ docs: [{ isCoach: true, memberships: [{ isLeader: false }] }] })
    await expect(createOrReuseLeaderResourceShare(245)).resolves.toBeNull()
    expect(mocks.detail).not.toHaveBeenCalled()
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
