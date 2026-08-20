import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMemberPortalHome: vi.fn(),
  getMemberResourceDetail: vi.fn(),
  redirect: vi.fn(),
  trackedNotFound: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))
vi.mock('@/lib/tracked-not-found', () => ({ trackedNotFound: mocks.trackedNotFound }))
vi.mock('@/lib/members/data', () => ({
  getMemberPortalHome: mocks.getMemberPortalHome,
  getMemberResourceDetail: mocks.getMemberResourceDetail,
}))
vi.mock('@/components/members/LeaderResourceVideoButton', () => ({
  LeaderResourceVideoButton: () => <button type="button">Play video</button>,
}))
vi.mock('@/components/members/LeaderResourceShareButton', () => ({
  LeaderResourceShareButton: () => <button type="button">Share</button>,
}))
vi.mock('@/components/members/MemberPortalChrome', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/components/members/MemberPortalChrome')>(),
  MemberPortalChrome: ({ children }: { children: React.ReactNode }) => children,
}))

import LeaderResourceDetailPage from './page'

const profile = {
  personId: 42,
  name: 'Aroha Ngata',
  email: 'aroha@example.com',
  avatarUrl: null,
}

const resource = {
  rockId: 201,
  title: 'Hebrews Study 4',
  startDateTime: '2026-08-09T00:00:00.000Z',
  expireDateTime: '2026-08-15T00:00:00.000Z',
  description: 'Study Hebrews together.',
  youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  promotionalImageUrl: null,
  hosts: [{ name: 'Leader Name', avatarUrl: null }],
  bibleReference: 'Hebrews 4:14-5:10',
  hasLeaderNotes: true,
  hasMemberStudy: true,
  campusNames: [],
  priority: 0,
  sourceOrder: 0,
}

describe('LeaderResourceDetailPage authorization rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMemberResourceDetail.mockResolvedValue({
      access: 'granted',
      canAccessLeaderContent: true,
      resource,
    })
  })

  it('shows ordinary members the study without video, leader notes, or sharing', async () => {
    mocks.getMemberPortalHome.mockResolvedValue({
      profile,
      groups: [],
      canAccessLeaderResources: false,
    })
    mocks.getMemberResourceDetail.mockResolvedValue({
      access: 'granted',
      canAccessLeaderContent: false,
      resource: {
        ...resource,
        youtubeUrl: null,
        hosts: [],
        hasLeaderNotes: false,
      },
    })

    const markup = renderToStaticMarkup(await LeaderResourceDetailPage({
      params: Promise.resolve({ rockId: '201' }),
    }))

    expect(markup).toContain('/201/files/member-study')
    expect(markup).not.toContain('/201/files/leader-notes')
    expect(markup).not.toContain('Play video')
    expect(markup).not.toContain('>Share<')
  })

  it('retains video and leader-note actions for leaders and coaches', async () => {
    mocks.getMemberPortalHome.mockResolvedValue({
      profile,
      groups: [{ rockGroupId: 10 }],
      canAccessLeaderResources: true,
    })

    const markup = renderToStaticMarkup(await LeaderResourceDetailPage({
      params: Promise.resolve({ rockId: '201' }),
    }))

    expect(markup).toContain('Play video')
    expect(markup).toContain('/201/files/leader-notes')
    expect(markup).toContain('/201/files/member-study')
    expect(markup).toContain('>Share<')
  })

  it('redirects signed-out visitors to sign in with the detail return path', async () => {
    mocks.getMemberPortalHome.mockResolvedValue(null)
    mocks.getMemberResourceDetail.mockResolvedValue(null)
    mocks.redirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT')
    })

    await expect(LeaderResourceDetailPage({
      params: Promise.resolve({ rockId: '201' }),
    })).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith(
      '/auth/login?returnTo=%2Fmembers%2Fconnect-group-leader-resources%2F201',
    )
  })
})
