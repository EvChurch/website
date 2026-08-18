import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getMemberPortalHome: vi.fn(),
  getMemberGroupCoaching: vi.fn(),
  getMemberGroupCommentThread: vi.fn(),
  redirect: vi.fn((href: string) => { throw new Error(`NEXT_REDIRECT:${href}`) }),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
}))

vi.mock('@/lib/members/data', () => ({
  getMemberPortalHome: mocks.getMemberPortalHome,
  getMemberGroupCoaching: mocks.getMemberGroupCoaching,
  getMemberGroupCommentThread: mocks.getMemberGroupCommentThread,
}))
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  notFound: mocks.notFound,
}))
vi.mock('@/components/members/MemberPortalChrome', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/components/members/MemberPortalChrome')>(),
  MemberPortalChrome: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@/components/members/MemberAvatar', () => ({
  MemberAvatar: ({ name }: { name: string }) => <span>{name} avatar</span>,
}))

import ConnectGroupCoachingPage from './page'

const group = {
  rockGroupId: 10,
  name: 'Tuesday Central Connect',
  campusName: 'Central',
  campusSlug: 'central',
  locationName: null,
  locationAddress: null,
  isLeader: true,
  isCoached: false,
  isCoach: false,
  roleName: 'Leader',
}

describe('ConnectGroupCoachingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getMemberPortalHome.mockResolvedValue({
      profile: { personId: 42, name: 'Aroha', email: 'aroha@example.com', avatarUrl: null },
      groups: [group],
      canAccessLeaderResources: true,
    })
    mocks.getMemberGroupCoaching.mockResolvedValue({
      access: 'granted',
      group,
      people: [
        { rockPersonId: 84, name: 'Moana', email: 'moana@example.com', phones: [{ number: '09 555 0100', typeValueId: 13, isMessagingEnabled: false }, { number: '021 555 0100', typeValueId: 12, isMessagingEnabled: true }], avatarUrl: null, isCoach: true, isLeader: false },
        { rockPersonId: 42, name: 'Aroha', email: null, phones: [], avatarUrl: null, isCoach: false, isLeader: true },
      ],
    })
    mocks.getMemberGroupCommentThread.mockResolvedValue({
      access: 'granted',
      canPostCoachesOnly: false,
      currentAuthor: { name: 'Aroha', avatarUrl: null },
      comments: [],
    })
  })

  it('shows coaches and leaders above the group comment thread', async () => {
    const markup = renderToStaticMarkup(await ConnectGroupCoachingPage({
      params: Promise.resolve({ rockGroupId: '10' }),
    }))

    expect(markup).toContain('Coaches and group leaders')
    expect(markup.indexOf('Moana')).toBeLessThan(markup.indexOf('Comments'))
    expect(markup).toContain('Coach')
    expect(markup).toContain('Leader')
    expect(markup).toContain('Comments')
    expect(markup.indexOf(group.name)).toBeLessThan(markup.indexOf('Coaching'))
    expect(markup).not.toContain('>Coaches and group leaders</h2>')
    expect(markup).toContain('mailto:moana@example.com')
    expect(markup).toContain('tel:095550100')
    expect(markup).toContain('sms:0215550100')
  })

  it('preserves the coaching route through sign-in', async () => {
    mocks.getMemberPortalHome.mockResolvedValue(null)

    await expect(ConnectGroupCoachingPage({
      params: Promise.resolve({ rockGroupId: '10' }),
    })).rejects.toThrow(
      'NEXT_REDIRECT:/auth/login?returnTo=%2Fmembers%2Fconnect-groups%2F10%2Fcoaching',
    )
  })

  it('does not reveal the page to an unauthorized member', async () => {
    mocks.getMemberGroupCoaching.mockResolvedValue({ access: 'denied' })

    await expect(ConnectGroupCoachingPage({
      params: Promise.resolve({ rockGroupId: '10' }),
    })).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
