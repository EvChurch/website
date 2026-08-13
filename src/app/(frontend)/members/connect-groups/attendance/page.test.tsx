import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getLedConnectGroups: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`)
  }),
}))

vi.mock('@/lib/members/data', () => ({
  getLedConnectGroups: mocks.getLedConnectGroups,
}))

vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

vi.mock('@/components/members/MemberPortalChrome', () => ({
  memberConnectGroupHref: () => '/members/connect-groups',
  MemberPortalChrome: ({ children }: { children: React.ReactNode }) => children,
}))

import ConnectGroupAttendanceResolverPage from './page'

const profile = {
  personId: 42,
  name: 'Aroha Ngata',
  email: 'aroha@example.com',
  avatarUrl: null,
}

const group = {
  rockGroupId: 10,
  name: 'Tuesday Central Connect',
  campusName: 'Central',
  campusSlug: 'central',
  locationName: 'Mt Eden',
  locationAddress: 'Auckland',
  isLeader: true,
  roleName: 'Leader',
}

describe('Connect Group attendance resolver', () => {
  beforeEach(() => vi.clearAllMocks())

  it('preserves the resolver route through sign-in', async () => {
    mocks.getLedConnectGroups.mockResolvedValue(null)

    await expect(ConnectGroupAttendanceResolverPage()).rejects.toThrow(
      'NEXT_REDIRECT:/auth/login?returnTo=%2Fmembers%2Fconnect-groups%2Fattendance',
    )
  })

  it('redirects a single led group to its attendance screen', async () => {
    mocks.getLedConnectGroups.mockResolvedValue({
      profile,
      groups: [group],
      canAccessLeaderResources: true,
    })

    await expect(ConnectGroupAttendanceResolverPage()).rejects.toThrow(
      'NEXT_REDIRECT:/members/connect-groups/10/attendance',
    )
  })

  it('shows a chooser containing only led groups', async () => {
    mocks.getLedConnectGroups.mockResolvedValue({
      profile,
      groups: [group, { ...group, rockGroupId: 11, name: 'Thursday Connect' }],
      canAccessLeaderResources: true,
    })

    const markup = renderToStaticMarkup(await ConnectGroupAttendanceResolverPage())

    expect(markup).toContain('Choose a Connect Group')
    expect(markup).toContain('/members/connect-groups/10/attendance')
    expect(markup).toContain('/members/connect-groups/11/attendance')
  })

  it('shows a private unavailable state when no groups are led', async () => {
    mocks.getLedConnectGroups.mockResolvedValue({
      profile,
      groups: [],
      canAccessLeaderResources: true,
    })

    const markup = renderToStaticMarkup(await ConnectGroupAttendanceResolverPage())

    expect(markup).toContain('Attendance is unavailable')
  })
})
