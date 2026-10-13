import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMemberPortalHome: vi.fn(),
  getPublishedDailyReadings: vi.fn(),
  isDailyReadingEmailSubscribed: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('@/lib/members/data', () => ({
  getMemberPortalHome: mocks.getMemberPortalHome,
}))
vi.mock('@/lib/daily-readings/data', () => ({
  getPublishedDailyReadings: mocks.getPublishedDailyReadings,
}))
vi.mock('@/lib/daily-readings/email-subscription', () => ({
  isDailyReadingEmailSubscribed: mocks.isDailyReadingEmailSubscribed,
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
vi.mock('@/components/daily-readings/DailyReadingEmailSignup', () => ({
  DailyReadingEmailSignup: ({ initiallySubscribed }: { initiallySubscribed: boolean }) => (
    <p>Email signup: {String(initiallySubscribed)}</p>
  ),
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import MemberDailyReadingsPage from './page'

describe('MemberDailyReadingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMemberPortalHome.mockResolvedValue({
      profile: { personId: 42, name: 'Aroha Ngata', email: 'aroha@example.com', avatarUrl: null },
      groups: [],
      canAccessLeaderResources: false,
    })
    mocks.getPublishedDailyReadings.mockResolvedValue([{ rockId: 16160 }])
    mocks.isDailyReadingEmailSubscribed.mockResolvedValue(false)
  })

  it('renders the archive in the Daily Reading member section', async () => {
    const markup = renderToStaticMarkup(await MemberDailyReadingsPage())

    expect(markup).toContain('data-active="reading"')
    expect(markup).toContain('1 readings')
    expect(markup).toContain('Email signup: false')
  })

  it('keeps email signup available while no readings are published', async () => {
    mocks.getPublishedDailyReadings.mockResolvedValue([])

    const markup = renderToStaticMarkup(await MemberDailyReadingsPage())

    expect(markup).toContain('The next reading is on its way.')
    expect(markup).toContain('Email signup: false')
  })

  it('passes existing subscription state to the CTA', async () => {
    mocks.isDailyReadingEmailSubscribed.mockResolvedValue(true)
    const markup = renderToStaticMarkup(await MemberDailyReadingsPage())
    expect(markup).toContain('Email signup: true')
    expect(mocks.isDailyReadingEmailSubscribed).toHaveBeenCalledWith(42)
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
