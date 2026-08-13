import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMemberPortalHome: vi.fn(),
  getMemberGroupDetail: vi.fn(),
  getGroupCurrentResources: vi.fn(),
  notFound: vi.fn(),
  trackedNotFound: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}))
vi.mock('@/lib/tracked-not-found', () => ({ trackedNotFound: mocks.trackedNotFound }))
vi.mock('@/lib/members/data', () => ({
  getMemberPortalHome: mocks.getMemberPortalHome,
  getMemberGroupDetail: mocks.getMemberGroupDetail,
  getGroupCurrentResources: mocks.getGroupCurrentResources,
}))
vi.mock('@/components/members/LeaderResourceTimeline', () => ({
  LeaderResourceThisWeek: ({ current, audience }: {
    current: Array<{ title: string }>
    audience?: 'leader' | 'member'
  }) => (
    current.length > 0 ? <section>This week ({audience ?? 'leader'}): {current[0].title}</section> : null
  ),
}))
vi.mock('@/components/members/MemberPortalChrome', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/components/members/MemberPortalChrome')>(),
  MemberPortalChrome: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@/components/members/MemberAvatar', () => ({
  MemberAvatar: ({ name }: { name: string }) => <span>{name}</span>,
}))

import ConnectGroupDetailPage from './page'

const profile = {
  personId: 42,
  name: 'Aroha Ngata',
  email: 'aroha@example.com',
  avatarUrl: null,
}

const currentGroup = {
  rockGroupId: 10,
  name: 'Tuesday Central Connect',
  campusName: 'Central',
  campusSlug: 'central',
  locationName: null,
  locationAddress: null,
  isLeader: false,
  roleName: 'Member',
}

describe('ConnectGroupDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getGroupCurrentResources.mockResolvedValue({
      access: 'granted',
      current: [],
    })
    mocks.getMemberGroupDetail.mockResolvedValue({
      access: 'granted',
      group: currentGroup,
      people: [],
    })
  })

  it('shows this week for a group leader when a current resource exists', async () => {
    const leaderGroup = { ...currentGroup, isLeader: true, roleName: 'Leader' }
    mocks.getMemberPortalHome.mockResolvedValue({
      profile,
      groups: [leaderGroup],
      canAccessLeaderResources: true,
    })
    mocks.getMemberGroupDetail.mockResolvedValue({
      access: 'granted',
      group: leaderGroup,
      people: [],
    })
    mocks.getGroupCurrentResources.mockResolvedValue({
      access: 'granted',
      current: [{ rockId: 200, title: 'Hebrews Study 4' }],
    })

    const markup = renderToStaticMarkup(await ConnectGroupDetailPage({
      params: Promise.resolve({ rockGroupId: '10' }),
    }))

    expect(markup).toContain('This week (leader): Hebrews Study 4')
    expect(markup).toContain('href="/members/connect-groups/10/attendance"')
    expect(markup).toContain('Record attendance')
  })

  it('shows attendance success at the top after returning from save', async () => {
    mocks.getMemberPortalHome.mockResolvedValue({
      profile,
      groups: [currentGroup],
      canAccessLeaderResources: false,
    })

    const markup = renderToStaticMarkup(await ConnectGroupDetailPage({
      params: Promise.resolve({ rockGroupId: '10' }),
      searchParams: Promise.resolve({ attendance: 'saved' }),
    }))

    expect(markup).toContain('Attendance saved successfully')
    expect(markup.indexOf('Attendance saved successfully')).toBeLessThan(markup.indexOf(currentGroup.name))
  })

  it('shows the member weekly variant to a non-leader', async () => {
    mocks.getMemberPortalHome.mockResolvedValue({
      profile,
      groups: [currentGroup],
      canAccessLeaderResources: false,
    })
    mocks.getGroupCurrentResources.mockResolvedValue({
      access: 'granted',
      current: [{ rockId: 200, title: 'Hebrews Study 4' }],
    })

    const markup = renderToStaticMarkup(await ConnectGroupDetailPage({
      params: Promise.resolve({ rockGroupId: '10' }),
    }))

    expect(mocks.getGroupCurrentResources).toHaveBeenCalledWith(10, 'central', 'member')
    expect(markup).toContain('This week (member): Hebrews Study 4')
  })

  it('keeps the leader variant for a coach with an ordinary group membership', async () => {
    mocks.getMemberPortalHome.mockResolvedValue({
      profile,
      groups: [currentGroup],
      canAccessLeaderResources: true,
    })
    mocks.getGroupCurrentResources.mockResolvedValue({
      access: 'granted',
      current: [{ rockId: 200, title: 'Hebrews Study 4' }],
    })

    const markup = renderToStaticMarkup(await ConnectGroupDetailPage({
      params: Promise.resolve({ rockGroupId: '10' }),
    }))

    expect(mocks.getGroupCurrentResources).toHaveBeenCalledWith(10, 'central', 'leader')
    expect(markup).toContain('This week (leader): Hebrews Study 4')
    expect(markup).not.toContain('/attendance')
  })

  it('does not show an empty this week banner for a group leader', async () => {
    const leaderGroup = { ...currentGroup, isLeader: true, roleName: 'Leader' }
    mocks.getMemberPortalHome.mockResolvedValue({
      profile,
      groups: [leaderGroup],
      canAccessLeaderResources: true,
    })
    mocks.getMemberGroupDetail.mockResolvedValue({
      access: 'granted',
      group: leaderGroup,
      people: [],
    })

    const markup = renderToStaticMarkup(await ConnectGroupDetailPage({
      params: Promise.resolve({ rockGroupId: '10' }),
    }))

    expect(mocks.getGroupCurrentResources).toHaveBeenCalledWith(10, 'central', 'leader')
    expect(markup).not.toContain('This week:')
  })

  it('does not offer a list-page back link when the member has one group', async () => {
    mocks.getMemberPortalHome.mockResolvedValue({
      profile,
      groups: [currentGroup],
      canAccessLeaderResources: false,
    })

    const markup = renderToStaticMarkup(await ConnectGroupDetailPage({
      params: Promise.resolve({ rockGroupId: '10' }),
    }))

    expect(markup).not.toContain('Back to your groups')
  })

  it('keeps the list-page back link when the member has multiple groups', async () => {
    mocks.getMemberPortalHome.mockResolvedValue({
      profile,
      groups: [currentGroup, { ...currentGroup, rockGroupId: 20, name: 'Sunday North Connect' }],
      canAccessLeaderResources: false,
    })

    const markup = renderToStaticMarkup(await ConnectGroupDetailPage({
      params: Promise.resolve({ rockGroupId: '10' }),
    }))

    expect(markup).toContain('Back to your groups')
    expect(markup).toContain('href="/members/connect-groups"')
  })

  it('uses compact contact actions without member or text-enabled lines', async () => {
    mocks.getMemberPortalHome.mockResolvedValue({
      profile,
      groups: [currentGroup],
      canAccessLeaderResources: false,
    })
    mocks.getMemberGroupDetail.mockResolvedValue({
      access: 'granted',
      group: currentGroup,
      people: [{
        rockPersonId: 84,
        name: 'Wiremu Rangi',
        email: 'wiremu@example.com',
        phones: [{ number: '021 555 0100', typeValueId: 12, isMessagingEnabled: false }],
        avatarUrl: null,
        roleName: 'Participant',
        isLeader: false,
        isCurrentMember: true,
      }],
    })

    const markup = renderToStaticMarkup(await ConnectGroupDetailPage({
      params: Promise.resolve({ rockGroupId: '10' }),
    }))

    expect(markup).toContain('href="mailto:wiremu@example.com"')
    expect(markup).toContain('href="tel:0215550100"')
    expect(markup).toContain('href="sms:0215550100"')
    expect(markup).not.toContain('Participant')
    expect(markup).not.toContain('Text enabled')
    expect(markup).not.toContain('>You</span>')
    expect(markup).not.toContain('1 active person')
    expect(markup).not.toContain('>Central</span>')
    expect(markup).not.toContain('>Member</span>')
  })

  it('shows disabled contact actions when details are unavailable', async () => {
    mocks.getMemberPortalHome.mockResolvedValue({
      profile,
      groups: [currentGroup],
      canAccessLeaderResources: false,
    })
    mocks.getMemberGroupDetail.mockResolvedValue({
      access: 'granted',
      group: currentGroup,
      people: [{
        rockPersonId: 85,
        name: 'No Contact',
        email: null,
        phones: [],
        avatarUrl: null,
        roleName: 'Member',
        isLeader: false,
        isCurrentMember: false,
      }],
    })

    const markup = renderToStaticMarkup(await ConnectGroupDetailPage({
      params: Promise.resolve({ rockGroupId: '10' }),
    }))

    expect(markup).toContain('aria-label="Email No Contact unavailable"')
    expect(markup).toContain('aria-label="Call No Contact unavailable"')
    expect(markup).toContain('aria-label="Text No Contact unavailable"')
  })

  it('shows a calm leader attendance view with people needing attention first', async () => {
    const leaderGroup = { ...currentGroup, isLeader: true, roleName: 'Leader' }
    mocks.getMemberPortalHome.mockResolvedValue({
      profile,
      groups: [leaderGroup],
      canAccessLeaderResources: true,
    })
    mocks.getMemberGroupDetail.mockResolvedValue({
      access: 'granted',
      group: leaderGroup,
      attendance: {
        people: {
          84: {
            needsAttention: true,
            attentionLabel: '2 CGs missed',
            connectGroup: {
              recent: [
                { date: '2026-07-15', didAttend: true },
                { date: '2026-07-22', didAttend: true },
                { date: '2026-07-29', didAttend: false },
                { date: '2026-08-05', didAttend: false },
              ],
              ytdPercentage: 50,
              missedInARow: 2,
            },
            church: {
              recent: [{ date: '2026-08-09', didAttend: true }],
              ytdPercentage: 75,
              missedInARow: 0,
            },
          },
          85: {
            needsAttention: false,
            attentionLabel: null,
            connectGroup: { recent: [], ytdPercentage: 90, missedInARow: 0 },
            church: { recent: [], ytdPercentage: 88, missedInARow: 0 },
          },
        },
        summary: {
          connectGroup: { recentPercentage: 72, ytdPercentage: 76 },
          church: { recentPercentage: 81, ytdPercentage: 79 },
        },
        monthly: [
          {
            month: '2026-07',
            connectGroupPercentage: null,
            churchPercentage: 70,
          },
          {
            month: '2026-08',
            connectGroupPercentage: 72,
            churchPercentage: 68,
          },
        ],
      },
      people: [
        {
          rockPersonId: 85,
          name: 'Calm Member',
          email: null,
          phones: [],
          avatarUrl: null,
          roleName: 'Member',
          isLeader: false,
          isCurrentMember: false,
        },
        {
          rockPersonId: 84,
          name: 'Needs Follow Up',
          email: null,
          phones: [{ number: '021 555 0100', typeValueId: 12, isMessagingEnabled: true }],
          avatarUrl: null,
          roleName: 'Member',
          isLeader: false,
          isCurrentMember: false,
        },
      ],
    })

    const markup = renderToStaticMarkup(await ConnectGroupDetailPage({
      params: Promise.resolve({ rockGroupId: '10' }),
    }))

    expect(markup).toContain('Needs attention')
    expect(markup).toContain('2 CGs missed')
    expect(markup).toContain('72%')
    expect(markup).toContain('aria-label="Group attendance summary"')
    expect(markup.match(/data-attendance-summary/g)).toHaveLength(1)
    expect(markup).toContain('role="tooltip"')
    expect(markup).toContain('72%')
    expect(markup).toContain('No data')
    expect(markup).toContain('tabindex="0"')
    expect(markup.indexOf('Needs Follow Up')).toBeLessThan(markup.indexOf('Calm Member'))
    expect(markup).not.toContain('Two consecutive missed')
  })
})
