import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMemberPortalHome: vi.fn(),
  getLatestDailyReading: vi.fn(),
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
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import MembersPage from './page'

describe('MembersPage Connect Group navigation', () => {
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
