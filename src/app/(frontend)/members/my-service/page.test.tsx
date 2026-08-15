import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getMemberPortalHomeForProfile: vi.fn(),
  getVolunteerSchedule: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
  memberPortalActive: vi.fn(),
}))

vi.mock('@/auth/auth0-client', () => ({ getAuth0Client: () => ({ getSession: mocks.getSession }) }))
vi.mock('@/lib/members/data', () => ({ getMemberPortalHomeForProfile: mocks.getMemberPortalHomeForProfile }))
vi.mock('@/lib/members/volunteer-scheduling', () => ({
  getVolunteerSchedule: mocks.getVolunteerSchedule,
}))
vi.mock('@/components/members/MemberPortalChrome', () => ({
  memberConnectGroupHref: () => '/members/connect-groups',
  MemberPortalChrome: ({ active, children }: { active?: string; children: React.ReactNode }) => {
    mocks.memberPortalActive(active)
    return children
  },
}))
vi.mock('@/components/members/VolunteerSchedule', () => ({
  VolunteerSchedule: ({ schedule, isImpersonating }: {
    schedule: { status: string }
    isImpersonating: boolean
  }) => <p>{schedule.status}:{isImpersonating ? 'read-only' : 'interactive'}</p>,
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))

import MyServicePage, { metadata } from './page'

const home = {
  profile: {
    personId: 42,
    name: 'Aroha Ngata',
    email: 'aroha@example.com',
    avatarUrl: null,
  },
  groups: [],
  canAccessLeaderResources: false,
}

describe('MyServicePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({
      user: { sub: 'auth0|42' },
      rockProfile: {
        version: 3,
        status: 'resolved',
        profile: { ...home.profile, photoUrl: null, campusSlug: null },
      },
    })
    mocks.getMemberPortalHomeForProfile.mockResolvedValue(home)
    mocks.getVolunteerSchedule.mockResolvedValue({
      status: 'available',
      requests: [],
      upcoming: [],
      declined: [],
    })
  })

  it('is non-indexable and loads the signed-in person schedule', async () => {
    expect(metadata).toMatchObject({
      title: 'My Service',
      robots: { index: false, follow: false },
    })

    const markup = renderToStaticMarkup(await MyServicePage())
    expect(mocks.getVolunteerSchedule).toHaveBeenCalledWith(42)
    expect(markup).toContain('<h1')
    expect(markup).toContain('My Service')
    expect(markup).toContain('available:interactive')
    expect(mocks.memberPortalActive).toHaveBeenCalledWith('service')
  })

  it('redirects signed-out visitors to login with a fixed safe return path', async () => {
    mocks.getSession.mockResolvedValue(null)

    await expect(MyServicePage()).rejects.toThrow(
      'NEXT_REDIRECT:/auth/login?returnTo=%2Fmembers%2Fmy-service',
    )

    expect(mocks.redirect).toHaveBeenCalledWith('/auth/login?returnTo=%2Fmembers%2Fmy-service')
    expect(mocks.getVolunteerSchedule).not.toHaveBeenCalled()
  })

  it('keeps the member shell when Rock throws and passes an unavailable schedule', async () => {
    mocks.getVolunteerSchedule.mockRejectedValue(new Error('private upstream detail'))

    const markup = renderToStaticMarkup(await MyServicePage())

    expect(markup).toContain('My Service')
    expect(markup).toContain('unavailable:interactive')
    expect(markup).not.toContain('private upstream detail')
  })

  it('marks the schedule read-only during member impersonation', async () => {
    mocks.getSession.mockResolvedValue({
      user: { sub: 'auth0|admin' },
      rockProfile: {
        version: 3,
        status: 'resolved',
        profile: { ...home.profile, photoUrl: null, campusSlug: null },
      },
      memberImpersonation: {
        version: 1,
        status: 'active',
        originalHadRockProfile: false,
        originalRockProfile: null,
        targetProfile: { ...home.profile, photoUrl: null, campusSlug: null },
      },
    })

    const markup = renderToStaticMarkup(await MyServicePage())

    expect(markup).toContain('available:read-only')
  })
})
