import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  chrome: vi.fn(({ children }: { children: React.ReactNode }) => children),
  getMemberPortalHome: vi.fn(),
  getMemberResources: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('@/components/members/MemberPortalChrome', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/components/members/MemberPortalChrome')>(),
  MemberPortalChrome: mocks.chrome,
}))
vi.mock('@/components/members/LeaderResourceTimeline', () => ({
  LeaderResourceTimeline: ({ audience }: { audience?: string }) => <div>Audience: {audience}</div>,
}))
vi.mock('@/lib/members/data', () => ({
  getMemberPortalHome: mocks.getMemberPortalHome,
  getMemberResources: mocks.getMemberResources,
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
  redirect: mocks.redirect,
}))

import LeaderResourcesPage from './page'

describe('LeaderResourcesPage member navigation', () => {
  it('links directly to the only Connect Group', async () => {
    mocks.getMemberPortalHome.mockResolvedValue({
      profile: {
        personId: 42,
        name: 'Aroha Ngata',
        email: 'aroha@example.com',
        avatarUrl: null,
      },
      groups: [{ rockGroupId: 10 }],
      canAccessLeaderResources: true,
    })
    mocks.getMemberResources.mockResolvedValue({
      access: 'granted',
      current: [],
      upcoming: [],
      history: [],
    })

    renderToStaticMarkup(await LeaderResourcesPage())

    expect(mocks.chrome).toHaveBeenCalledWith(
      expect.objectContaining({ connectGroupHref: '/members/connect-groups/10' }),
      undefined,
    )
  })

  it('renders the member-safe hub for an ordinary signed-in member', async () => {
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
    mocks.getMemberResources.mockResolvedValue({
      access: 'granted',
      current: [],
      upcoming: [],
      history: [],
    })

    const markup = renderToStaticMarkup(await LeaderResourcesPage())

    expect(markup).toContain('Audience: member')
  })

  it('redirects signed-out visitors to sign in with the hub return path', async () => {
    mocks.getMemberPortalHome.mockResolvedValue(null)
    mocks.getMemberResources.mockResolvedValue(null)
    mocks.redirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT')
    })

    await expect(LeaderResourcesPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(mocks.redirect).toHaveBeenCalledWith(
      '/auth/login?returnTo=%2Fmembers%2Fconnect-group-leader-resources',
    )
  })
})
