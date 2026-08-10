import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  chrome: vi.fn(({ children }: { children: React.ReactNode }) => children),
  getMemberPortalHome: vi.fn(),
  getMemberResources: vi.fn(),
}))

vi.mock('@/components/members/MemberPortalChrome', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/components/members/MemberPortalChrome')>(),
  MemberPortalChrome: mocks.chrome,
}))
vi.mock('@/components/members/LeaderResourceTimeline', () => ({
  LeaderResourceTimeline: () => null,
}))
vi.mock('@/lib/members/data', () => ({
  getMemberPortalHome: mocks.getMemberPortalHome,
  getMemberResources: mocks.getMemberResources,
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
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
})
