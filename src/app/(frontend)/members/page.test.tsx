import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMemberPortalHome: vi.fn(),
  getCurrentCourseIdentity: vi.fn(),
  redirect: vi.fn((path: string): never => { throw new Error(`NEXT_REDIRECT:${path}`) }),
  getLatestDailyReading: vi.fn(),
}))

vi.mock('@/auth/course-session', () => ({
  getCurrentCourseIdentity: mocks.getCurrentCourseIdentity,
}))
vi.mock('@/lib/members/data', () => ({
  getMemberPortalHome: mocks.getMemberPortalHome,
}))
vi.mock('@/lib/daily-readings/data', () => ({
  getLatestDailyReading: mocks.getLatestDailyReading,
  formatReadingDate: () => '11 August 2026',
}))
vi.mock('@/components/members/MemberPortalChrome', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/components/members/MemberPortalChrome')>(),
  MemberPortalChrome: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import MembersPage from './page'

describe('MembersPage Connect Group navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentCourseIdentity.mockResolvedValue(null)
  })

  it('returns account-only participants to Courses without restarting sign-in', async () => {
    mocks.getMemberPortalHome.mockResolvedValue(null)
    mocks.getCurrentCourseIdentity.mockResolvedValue({
      identityKey: 'course-account', issuer: 'https://auth.example.com/',
      subject: 'auth0|course-account', email: 'participant@example.com', name: 'Aroha',
    })

    await expect(MembersPage()).rejects.toThrow('NEXT_REDIRECT:/members/courses')

    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith('/members/courses')
    expect(mocks.getLatestDailyReading).not.toHaveBeenCalled()
  })

  it('keeps the existing sign-in destination for anonymous visitors', async () => {
    mocks.getMemberPortalHome.mockResolvedValue(null)

    await expect(MembersPage()).rejects.toThrow('NEXT_REDIRECT:/auth/login?returnTo=%2Fmembers')

    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith('/auth/login?returnTo=%2Fmembers')
    expect(mocks.getLatestDailyReading).not.toHaveBeenCalled()
  })
  it('links the Connect Group card directly to the only group', async () => {
    mocks.getLatestDailyReading.mockResolvedValue({
      rockId: 16160,
      passageReference: 'Hebrews 5:11-14',
      sourceDate: '2026-08-11T00:00:00.000Z',
    })
    mocks.getMemberPortalHome.mockResolvedValue({
      profile: {
        personId: 42,
        name: 'Aroha Ngata',
        email: 'aroha@example.com',
        avatarUrl: null,
      },
      groups: [{ rockGroupId: 10 }],
      canAccessLeaderResources: false,
    })

    const markup = renderToStaticMarkup(await MembersPage())

    expect(mocks.getCurrentCourseIdentity).not.toHaveBeenCalled()
    expect(mocks.redirect).not.toHaveBeenCalled()
    expect(markup).toContain('href="/members/connect-groups/10"')
    expect(markup).toContain('href="/members/daily-readings"')
    expect(markup).toContain('href="/members/connect-group-leader-resources"')
    expect(markup).toContain('href="/members/my-service"')
    expect(markup).toContain('My Service')
    expect(markup).toContain('requests')
    expect(markup).toContain('confirmed')
    expect(markup).toContain('Hebrews 5:11-14')
    expect(markup).toContain('Open Daily Reading')
    expect(markup).toContain('Open Study Resources')

    const hrefs = [...markup.matchAll(/<a[^>]+href="([^"]+)"/gu)].map((match) => match[1])
    expect(hrefs.slice(0, 5)).toEqual([
      '/members/daily-readings',
      '/members/connect-groups/10',
      '/members/connect-group-leader-resources',
      '/members/my-service',
      '/members/giving',
    ])
  })

  it('shows My Service without assignments or scheduling data', async () => {
    mocks.getLatestDailyReading.mockResolvedValue(null)
    mocks.getMemberPortalHome.mockResolvedValue({
      profile: {
        personId: 42,
        name: 'Aroha Ngata',
        email: 'aroha@example.com',
        avatarUrl: null,
      },
      groups: [],
      canAccessLeaderResources: false,
    })

    const markup = renderToStaticMarkup(await MembersPage())

    expect(markup).toContain('href="/members/my-service"')
    expect(markup).toContain('href="/members/connect-group-leader-resources"')
    expect(markup).toContain('rel="nofollow"')
    expect(markup).toContain('My Service')
  })
})
