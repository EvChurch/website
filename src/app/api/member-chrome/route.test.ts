import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  isCurrentPayloadAdmin: vi.fn(),
  readGivingE2E: vi.fn(),
  resolveGivingRuntimeConfiguration: vi.fn(),
  getTurnstileSiteKey: vi.fn(),
}))

vi.mock('@/auth/auth0-client', () => ({
  getAuth0Client: () => ({ getSession: mocks.getSession }),
}))
vi.mock('@/auth/payload-admin-session', () => ({
  isCurrentPayloadAdmin: mocks.isCurrentPayloadAdmin,
}))
vi.mock('@/lib/payload', () => ({ getPayloadClient: async () => ({}) }))
vi.mock('@/lib/giving/e2e-session', () => ({
  GIVING_E2E_COOKIE: '__Host-ev_giving_e2e',
  createPayloadGivingE2ESessionStore: () => ({}),
  createGivingE2ESessionService: () => ({ read: mocks.readGivingE2E }),
}))
vi.mock('@/lib/giving/availability', () => ({
  resolveGivingRuntimeConfiguration: mocks.resolveGivingRuntimeConfiguration,
}))
vi.mock('@/lib/rock-forms/config', () => ({ getTurnstileSiteKey: mocks.getTurnstileSiteKey }))

import { GET } from './route'

function request(cookie = '__Host-ev_admin_session=opaque') {
  return new NextRequest('https://www.ev.church/api/member-chrome', {
    headers: cookie ? { cookie } : undefined,
  })
}

describe('member chrome route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isCurrentPayloadAdmin.mockResolvedValue(false)
    mocks.readGivingE2E.mockResolvedValue(null)
    mocks.resolveGivingRuntimeConfiguration.mockReturnValue(null)
    mocks.getTurnstileSiteKey.mockReturnValue('turnstile-key')
  })

  it('short-circuits anonymous requests before initializing Auth0', async () => {
    const response = await GET(request(''))

    expect(response.status).toBe(200)
    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(mocks.isCurrentPayloadAdmin).not.toHaveBeenCalled()
  })

  it('preserves a resumable giving session for anonymous chrome', async () => {
    const response = await GET(request(`__Host-ev_giving_resume=${'A'.repeat(43)}`))

    await expect(response.json()).resolves.toMatchObject({
      memberProfile: null,
      givingResumeRequested: true,
    })
    expect(mocks.getSession).not.toHaveBeenCalled()
  })

  it('returns a private anonymous response without invoking Payload admin auth', async () => {
    mocks.getSession.mockResolvedValue(null)

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
    expect(response.headers.get('vary')).toContain('Cookie')
    await expect(response.json()).resolves.toEqual({
      memberProfile: null,
      memberCampusSlug: null,
      adminHref: null,
      impersonation: null,
      givingRuntime: null,
      givingResumeRequested: false,
      givingTurnstileSiteKey: 'turnstile-key',
    })
    expect(mocks.isCurrentPayloadAdmin).not.toHaveBeenCalled()
  })

  it('reuses one Auth0 session for the member and impersonation display', async () => {
    const profile = {
      personId: 42,
      name: 'Aroha Ngata',
      email: 'aroha@example.com',
      photoUrl: '/GetImage.ashx?id=abc',
      campusSlug: 'north',
    }
    mocks.getSession.mockResolvedValue({
      user: { sub: 'auth0|123' },
      rockProfile: { version: 3, status: 'resolved', profile },
      memberImpersonation: {
        version: 1,
        status: 'active',
        originalHadRockProfile: false,
        originalRockProfile: null,
        targetProfile: profile,
      },
    })
    mocks.isCurrentPayloadAdmin.mockResolvedValue(true)

    const memberRequest = request(
      '__Host-ev_admin_session__0=chunk-a; __Host-ev_admin_session__1=chunk-b',
    )
    const response = await GET(memberRequest)

    expect(mocks.getSession).toHaveBeenCalledWith(memberRequest)
    expect(mocks.isCurrentPayloadAdmin).toHaveBeenCalledOnce()
    await expect(response.json()).resolves.toEqual({
      memberProfile: {
        name: 'Aroha Ngata',
        email: 'aroha@example.com',
        avatarUrl: '/member-avatar',
      },
      memberCampusSlug: 'north',
      adminHref: '/admin/impersonate',
      impersonation: {
        personId: 42,
        name: 'Aroha Ngata',
        email: 'aroha@example.com',
      },
      givingRuntime: null,
      givingResumeRequested: false,
      givingTurnstileSiteKey: 'turnstile-key',
    })
  })

  it('returns a validated protected E2E runtime to the client chrome', async () => {
    mocks.getSession.mockResolvedValue({ user: { sub: 'auth0|admin' } })
    mocks.readGivingE2E.mockResolvedValue({ runId: 'run-1' })
    const runtime = {
      eligibility: 'protected-e2e',
      gatewayOrigins: ['https://sandbox.secure.blinkpay.co.nz'],
      synthetic: true,
    }
    mocks.resolveGivingRuntimeConfiguration.mockReturnValue(runtime)

    const response = await GET(request(
      '__Host-ev_admin_session=opaque; __Host-ev_giving_e2e=synthetic-token',
    ))

    await expect(response.json()).resolves.toMatchObject({ givingRuntime: runtime })
    expect(mocks.readGivingE2E).toHaveBeenCalledWith('synthetic-token')
    expect(mocks.resolveGivingRuntimeConfiguration).toHaveBeenCalledWith({ protectedE2E: true })
  })

  it('fails closed when the Auth0 session cannot be read', async () => {
    mocks.getSession.mockRejectedValue(new Error('unavailable'))

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(mocks.isCurrentPayloadAdmin).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      memberProfile: null,
      adminHref: null,
      impersonation: null,
    })
  })
})
