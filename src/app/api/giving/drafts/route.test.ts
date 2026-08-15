import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  subject: null as string | null,
  create: vi.fn(async () => ({ token: 'abcdefghijklmnopqrstuvwxyz0123456789_ABCDEF' })),
  readSession: vi.fn(async () => ({ amountMinor: 5000 })),
  revokeSession: vi.fn(async () => undefined),
}))

vi.mock('@/auth/auth0-client', () => ({
  getAuth0Client: () => ({ getSession: async () => state.subject ? { user: { sub: state.subject } } : null }),
}))
vi.mock('@/lib/payload', () => ({ getPayloadClient: async () => ({}) }))
vi.mock('@/lib/giving/drafts', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/giving/drafts')>()
  return {
    ...original,
    createPayloadGivingDraftStore: () => ({}),
    createGivingDraftService: () => ({
      create: state.create,
      readSession: state.readSession,
      revokeSession: state.revokeSession,
    }),
  }
})

import { DELETE, GET, POST } from './route'

const answers = {
  amountMinor: 5000,
  fundId: 2,
  frequency: 'monthly',
  startDate: '2026-09-01',
  firstName: '',
  lastName: '',
  email: '',
  returnPathname: '/events',
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('https://www.ev.church/api/giving/drafts', {
    method: 'POST',
    headers: { origin: 'https://www.ev.church', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('giving drafts route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.subject = null
    state.readSession.mockResolvedValue({ amountMinor: 5000 })
  })
  afterEach(() => vi.unstubAllEnvs())

  it('creates a guest draft with strict input handling, a nonce binding, and private headers', async () => {
    const response = await POST(post(answers))
    expect(response.status).toBe(201)
    expect(state.create).toHaveBeenCalledWith({
      answers,
      binding: { audience: 'guest', nonce: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u) },
    })
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('x-robots-tag')).toContain('noindex')
    expect(response.headers.get('set-cookie')).toContain('__Host-ev_giving_guest=')
    expect(response.headers.get('set-cookie')).toContain('Secure')
  })

  it('binds a signed-in draft to the server subject and does not issue a guest nonce', async () => {
    state.subject = 'auth0|member'
    const response = await POST(post(answers))
    expect(state.create).toHaveBeenCalledWith({ answers, binding: { audience: 'member', subject: 'auth0|member' } })
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it.each([
    ['cross origin', post(answers, { origin: 'https://evil.test' }), 403],
    ['wrong content type', post(answers, { 'content-type': 'text/plain' }), 415],
    ['extra body field', post({ ...answers, environment: 'production' }), 400],
    ['oversized declared body', post(answers, { 'content-length': '9000' }), 400],
  ])('rejects %s before persistence', async (_label, request, status) => {
    const response = await POST(request)
    expect(response.status).toBe(status)
    expect(state.create).not.toHaveBeenCalled()
  })

  it('rejects missing production origin and an oversized chunked body before persistence', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RAILWAY_PUBLIC_DOMAIN', 'www.ev.church')
    const missingOrigin = await POST(new NextRequest('https://www.ev.church/api/giving/drafts', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(answers),
    }))
    expect(missingOrigin.status).toBe(403)

    const encoder = new TextEncoder()
    const oversized = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(encoder.encode(`{"padding":"${'x'.repeat(9_000)}"}`)); controller.close() },
    })
    const chunked = await POST(new NextRequest('https://www.ev.church/api/giving/drafts', {
      method: 'POST', headers: { origin: 'https://www.ev.church', 'content-type': 'application/json' }, body: oversized, duplex: 'half',
    }))
    expect(chunked.status).toBe(400)
    expect(state.create).not.toHaveBeenCalled()
  })

  it('restores only from a cookie-bound session and uses one uniform unavailable response', async () => {
    const valid = new NextRequest('https://www.ev.church/api/giving/drafts', {
      headers: { cookie: '__Host-ev_giving_resume=resume-token; __Host-ev_giving_guest=guest-nonce' },
    })
    const response = await GET(valid)
    expect(response.status).toBe(200)
    expect(state.readSession).toHaveBeenCalledWith({ token: 'resume-token', binding: { audience: 'guest', nonce: 'guest-nonce' } })

    const missing = await GET(new NextRequest('https://www.ev.church/api/giving/drafts'))
    state.readSession.mockRejectedValueOnce(new Error('expired'))
    const expired = await GET(valid)
    expect(missing.status).toBe(404)
    expect(expired.status).toBe(404)
    await expect(missing.json()).resolves.toEqual({ error: 'Draft unavailable' })
    await expect(expired.json()).resolves.toEqual({ error: 'Draft unavailable' })
  })

  it('binds session restore to the authenticated server subject when present', async () => {
    state.subject = 'auth0|member'
    const response = await GET(new NextRequest('https://www.ev.church/api/giving/drafts', {
      headers: { cookie: '__Host-ev_giving_resume=resume-token; __Host-ev_giving_guest=ignored-guest' },
    }))
    expect(response.status).toBe(200)
    expect(state.readSession).toHaveBeenCalledWith({ token: 'resume-token', binding: { audience: 'member', subject: 'auth0|member' } })
  })

  it('requires same origin to revoke and clears the bound resume cookie', async () => {
    const request = new NextRequest('https://www.ev.church/api/giving/drafts', {
      method: 'DELETE',
      headers: { origin: 'https://www.ev.church', cookie: '__Host-ev_giving_resume=resume-token' },
    })
    const response = await DELETE(request)
    expect(response.status).toBe(200)
    expect(state.revokeSession).toHaveBeenCalledWith('resume-token')
    expect(response.headers.get('set-cookie')).toContain('__Host-ev_giving_resume=;')

    const denied = await DELETE(new NextRequest('https://www.ev.church/api/giving/drafts', { method: 'DELETE', headers: { origin: 'https://evil.test' } }))
    expect(denied.status).toBe(403)
    expect(state.revokeSession).toHaveBeenCalledTimes(1)
  })
})
