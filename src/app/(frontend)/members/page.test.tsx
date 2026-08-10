import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMemberPortalHome: vi.fn(),
}))

vi.mock('@/lib/members/data', () => ({
  getMemberPortalHome: mocks.getMemberPortalHome,
}))
vi.mock('@/components/members/MemberPortalChrome', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/components/members/MemberPortalChrome')>(),
  MemberPortalChrome: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

import MembersPage from './page'

describe('MembersPage Connect Group navigation', () => {
  it('links the Connect Group card directly to the only group', async () => {
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
  })
})
