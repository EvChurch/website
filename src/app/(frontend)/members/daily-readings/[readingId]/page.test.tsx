import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMemberPortalHome: vi.fn(),
  getDailyReadingByRockId: vi.fn(),
  redirect: vi.fn(),
  notFound: vi.fn(),
  trackedNotFound: vi.fn(),
}))

vi.mock('@/lib/members/data', () => ({
  getMemberPortalHome: mocks.getMemberPortalHome,
}))
vi.mock('@/lib/daily-readings/data', () => ({
  getDailyReadingByRockId: mocks.getDailyReadingByRockId,
  formatReadingDate: () => 'Tuesday, 11 August 2026',
}))
vi.mock('@/components/members/MemberPortalChrome', () => ({
  memberConnectGroupHref: () => '/members/connect-groups',
  MemberPortalChrome: ({ active, children }: { active?: string; children: React.ReactNode }) => (
    <div data-active={active}>{children}</div>
  ),
}))
vi.mock('@/components/daily-readings/DailyReadingFlow', () => ({
  DailyReadingFlow: () => <p>Guided reading</p>,
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }))
vi.mock('@/lib/tracked-not-found', () => ({ trackedNotFound: mocks.trackedNotFound }))

import MemberDailyReadingPage from './page'

const params = Promise.resolve({ readingId: '16160' })

describe('MemberDailyReadingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMemberPortalHome.mockResolvedValue({
      profile: { name: 'Aroha Ngata', email: 'aroha@example.com', avatarUrl: null },
      groups: [],
      canAccessLeaderResources: false,
    })
    mocks.getDailyReadingByRockId.mockResolvedValue({
      rockId: 16160,
      sourceDate: '2026-08-11T00:00:00.000Z',
      passageReference: 'Hebrews 5:11-14',
    })
  })

  it('renders the guide in the Daily Reading member section', async () => {
    const markup = renderToStaticMarkup(await MemberDailyReadingPage({ params }))

    expect(markup).toContain('data-active="reading"')
    expect(markup).toContain('href="/members/daily-readings"')
    expect(markup).toContain('Guided reading')
  })

  it('preserves the reading route through member login', async () => {
    mocks.getMemberPortalHome.mockResolvedValue(null)
    mocks.redirect.mockImplementation(() => {
      throw new Error('redirected')
    })

    await expect(MemberDailyReadingPage({ params })).rejects.toThrow('redirected')
    expect(mocks.redirect).toHaveBeenCalledWith(
      '/auth/login?returnTo=%2Fmembers%2Fdaily-readings%2F16160',
    )
  })
})
