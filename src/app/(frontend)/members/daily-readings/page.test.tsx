import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMemberPortalHome: vi.fn(),
  getPublishedDailyReadings: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('@/lib/members/data', () => ({
  getMemberPortalHome: mocks.getMemberPortalHome,
}))
vi.mock('@/lib/daily-readings/data', () => ({
  getPublishedDailyReadings: mocks.getPublishedDailyReadings,
}))
vi.mock('@/components/members/MemberPortalChrome', () => ({
  memberConnectGroupHref: () => '/members/connect-groups',
  MemberPortalChrome: ({ active, children }: { active?: string; children: React.ReactNode }) => (
    <div data-active={active}>{children}</div>
  ),
}))
vi.mock('@/components/daily-readings/ReadingHubClient', () => ({
  ReadingHubClient: ({ readings }: { readings: unknown[] }) => <p>{readings.length} readings</p>,
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import MemberDailyReadingsPage from './page'

describe('MemberDailyReadingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMemberPortalHome.mockResolvedValue({
      profile: { name: 'Aroha Ngata', email: 'aroha@example.com', avatarUrl: null },
      groups: [],
      canAccessLeaderResources: false,
    })
    mocks.getPublishedDailyReadings.mockResolvedValue([{ rockId: 16160 }])
  })

  it('renders the archive in the Daily Reading member section', async () => {
    const markup = renderToStaticMarkup(await MemberDailyReadingsPage())

    expect(markup).toContain('data-active="reading"')
    expect(markup).toContain('1 readings')
  })

  it('sends signed-out visitors through member login', async () => {
    mocks.getMemberPortalHome.mockResolvedValue(null)
    mocks.redirect.mockImplementation(() => {
      throw new Error('redirected')
    })

    await expect(MemberDailyReadingsPage()).rejects.toThrow('redirected')
    expect(mocks.redirect).toHaveBeenCalledWith('/auth/login?returnTo=%2Fmembers%2Fdaily-readings')
  })
})
