import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchMemberRockFile: vi.fn(),
  getMemberResourceAsset: vi.fn(),
}))

vi.mock('@/auth/member-rock-file', () => ({
  fetchMemberRockFile: mocks.fetchMemberRockFile,
  MemberRockFileUnavailableError: class MemberRockFileUnavailableError extends Error {},
}))
vi.mock('@/lib/members/data', () => ({
  getMemberResourceAsset: mocks.getMemberResourceAsset,
}))

import { GET } from './route'

describe('Connect Group resource file route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('serves an authorized member study as a private attachment', async () => {
    mocks.getMemberResourceAsset.mockResolvedValue({
      kind: 'file',
      guid: '44444444-4444-4444-8444-444444444444',
      name: 'Member study.pdf',
    })
    mocks.fetchMemberRockFile.mockResolvedValue({
      body: new Uint8Array([1, 2, 3]),
      contentType: 'application/pdf',
    })

    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ rockId: '201', kind: 'member-study' }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="Member study.pdf"',
    )
  })

  it.each(['leader-notes', 'member-study'])('returns not found when %s access is denied', async (kind) => {
    mocks.getMemberResourceAsset.mockResolvedValue(null)

    const response = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ rockId: '201', kind }),
    })

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.fetchMemberRockFile).not.toHaveBeenCalled()
  })
})
