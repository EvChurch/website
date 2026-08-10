import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMemberPortalHome: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/members/data', () => ({
  getMemberPortalHome: mocks.getMemberPortalHome,
}))
vi.mock('@/components/members/MemberPortalChrome', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/components/members/MemberPortalChrome')>(),
  MemberPortalChrome: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@/components/members/ConnectGroupCard', () => ({
  ConnectGroupCard: ({ group }: { group: { name: string } }) => <article>{group.name}</article>,
}))

import ConnectGroupsPage from './page'

const profile = {
  personId: 42,
  name: 'Aroha Ngata',
  email: 'aroha@example.com',
  avatarUrl: null,
}

function group(rockGroupId: number, name: string) {
  return {
    rockGroupId,
    name,
    campusName: 'Central',
    campusSlug: 'central',
    locationName: null,
    locationAddress: null,
    isLeader: false,
    roleName: 'Member',
  }
}

describe('ConnectGroupsPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redirects a signed-out visitor to login with the list return target', async () => {
    mocks.getMemberPortalHome.mockResolvedValue(null)

    await expect(ConnectGroupsPage()).rejects.toThrow(
      'NEXT_REDIRECT:/auth/login?returnTo=%2Fmembers%2Fconnect-groups',
    )
    expect(mocks.redirect).toHaveBeenCalledWith(
      '/auth/login?returnTo=%2Fmembers%2Fconnect-groups',
    )
  })

  it('redirects a member with one group straight to that group', async () => {
    mocks.getMemberPortalHome.mockResolvedValue({
      profile,
      groups: [group(10, 'Tuesday Central Connect')],
      canAccessLeaderResources: false,
    })

    await expect(ConnectGroupsPage()).rejects.toThrow(
      'NEXT_REDIRECT:/members/connect-groups/10',
    )
    expect(mocks.redirect).toHaveBeenCalledWith('/members/connect-groups/10')
  })

  it('keeps the list view for a member with multiple groups', async () => {
    mocks.getMemberPortalHome.mockResolvedValue({
      profile,
      groups: [
        group(10, 'Tuesday Central Connect'),
        group(20, 'Sunday North Connect'),
      ],
      canAccessLeaderResources: false,
    })

    const markup = renderToStaticMarkup(await ConnectGroupsPage())

    expect(markup).toContain('Tuesday Central Connect')
    expect(markup).toContain('Sunday North Connect')
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('keeps the empty list view when the member has no active group', async () => {
    mocks.getMemberPortalHome.mockResolvedValue({
      profile,
      groups: [],
      canAccessLeaderResources: false,
    })

    const markup = renderToStaticMarkup(await ConnectGroupsPage())

    expect(markup).toContain('No active Connect Group found')
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})
