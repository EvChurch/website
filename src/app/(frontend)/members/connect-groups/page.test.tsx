import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMemberPortalHome: vi.fn(),
  getMemberGroupDetail: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/members/data', () => ({
  getMemberPortalHome: mocks.getMemberPortalHome,
  getMemberGroupDetail: mocks.getMemberGroupDetail,
}))
vi.mock('@/components/members/MemberPortalChrome', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/components/members/MemberPortalChrome')>(),
  MemberPortalChrome: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@/components/members/ConnectGroupCard', () => ({
  ConnectGroupCard: ({ group, highlighted, attendance }: {
    group: { name: string }
    highlighted?: boolean
    attendance?: unknown
  }) => <article data-highlighted={highlighted || undefined} data-attendance={attendance ? 'true' : undefined}>{group.name}</article>,
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
    isCoached: false,
    isCoach: false,
    roleName: 'Member',
  }
}

describe('ConnectGroupsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMemberGroupDetail.mockResolvedValue({ access: 'granted', attendance: null })
  })

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
    expect(markup).toContain('>Connect Groups</h2>')
    expect(markup).not.toContain('Your groups and your people')
    expect(markup).not.toContain('If you belong to more than one active group')
    expect(mocks.getMemberGroupDetail).not.toHaveBeenCalled()
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('lists groups the member leads before their other memberships', async () => {
    mocks.getMemberPortalHome.mockResolvedValue({
      profile,
      groups: [
        group(10, 'Alpha Member Group'),
        { ...group(20, 'Zulu Led Group'), isLeader: true, roleName: 'Leader' },
      ],
      canAccessLeaderResources: true,
    })

    const markup = renderToStaticMarkup(await ConnectGroupsPage())

    expect(markup.indexOf('Zulu Led Group')).toBeLessThan(markup.indexOf('Alpha Member Group'))
    expect(mocks.getMemberGroupDetail).toHaveBeenCalledTimes(1)
    expect(mocks.getMemberGroupDetail).toHaveBeenCalledWith(20)
  })

  it('highlights the coach own group above the groups they coach', async () => {
    mocks.getMemberGroupDetail.mockResolvedValue({
      access: 'granted',
      attendance: {
        summary: {
          connectGroup: { recentPercentage: 62, ytdPercentage: 66 },
          church: { recentPercentage: 60, ytdPercentage: 62 },
        },
      },
    })
    mocks.getMemberPortalHome.mockResolvedValue({
      profile,
      groups: [
        { ...group(10, 'Tuesday Central Connect'), isCoach: true, roleName: 'Coach' },
        { ...group(20, 'Sunday North Connect'), isCoached: true, isCoach: true, roleName: 'Coach' },
        { ...group(30, 'Wednesday West Connect'), isCoached: true, isCoach: true, roleName: 'Coach' },
      ],
      canAccessLeaderResources: true,
    })

    const markup = renderToStaticMarkup(await ConnectGroupsPage())

    expect(markup.indexOf('Tuesday Central Connect')).toBeLessThan(
      markup.indexOf('Connect Groups I coach'),
    )
    expect(markup).toContain('data-highlighted="true"')
    expect(markup).toContain('Sunday North Connect')
    expect(markup).toContain('Wednesday West Connect')
    expect(markup.match(/data-attendance="true"/g)).toHaveLength(3)
    expect(mocks.getMemberGroupDetail).toHaveBeenCalledTimes(3)
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
