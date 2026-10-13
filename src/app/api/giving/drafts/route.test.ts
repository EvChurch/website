import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const state = vi.hoisted(() => ({
  subject: null as string | null,
  createSession: vi.fn(async()=>({token:'SESSIONabcdefghijklmnopqrstuvwxyz0123456789'})),
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
      createSession:state.createSession,
      readSession: state.readSession,
      revokeSession: state.revokeSession,
    }),
  }
})

import { DELETE, GET, PUT } from './route'

const answers = {
  amountMinor: 5000,
  fundId: 2,
  fundConfirmed: true,
  frequency: 'monthly',
  startDate: '2026-09-01',
  firstName: '',
  lastName: '',
  email: '',
}

function put(body:unknown,headers:Record<string,string>={}){return new NextRequest('https://www.ev.church/api/giving/drafts',{method:'PUT',headers:{origin:'https://www.ev.church','content-type':'application/json',...headers},body:JSON.stringify(body)})}

describe('giving drafts route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.subject = null
    state.readSession.mockResolvedValue({ amountMinor: 5000 })
  })
  afterEach(() => vi.unstubAllEnvs())

  it('creates a private cookie-bound guest recovery session', async () => {
    const result = await PUT(put(answers))

    expect(result.status).toBe(204)
    expect(state.createSession).toHaveBeenCalledWith({
      answers,
      binding: { audience: 'guest', nonce: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u) },
    })
    expect(result.headers.get('cache-control')).toBe('private, no-store, max-age=0')
    expect(result.headers.get('referrer-policy')).toBe('no-referrer')
    expect(result.headers.get('x-robots-tag')).toContain('noindex')
    expect(result.headers.get('set-cookie')).toContain('__Host-ev_giving_guest=')
    expect(result.headers.get('set-cookie')).toContain('__Host-ev_giving_resume=SESSION')
    expect(result.headers.get('set-cookie')).toContain('Secure')
  })

  it('binds a signed-in recovery session to the server subject', async () => {
    state.subject = 'auth0|member'
    const result = await PUT(put(answers))

    expect(result.status).toBe(204)
    expect(state.createSession).toHaveBeenCalledWith({
      answers,
      binding: { audience: 'member', subject: 'auth0|member' },
    })
    expect(result.headers.get('set-cookie')).not.toContain('__Host-ev_giving_guest=')
  })

  it('replaces the strict checkout recovery session without a resume-page fetch',async()=>{
    const request=put(answers,{cookie:'__Host-ev_giving_guest=guest-nonce; __Host-ev_giving_resume=prior-session'})
    const result=await PUT(request)
    expect(result.status).toBe(204)
    expect(state.createSession).toHaveBeenCalledWith({answers,binding:{audience:'guest',nonce:'guest-nonce'}})
    expect(state.revokeSession).toHaveBeenCalledWith('prior-session')
    expect(result.headers.get('set-cookie')).toContain('__Host-ev_giving_resume=SESSION')
    expect(result.headers.get('set-cookie')).toContain('SameSite=strict')
  })

  it('fails closed before replacing a draft session for cross-origin, oversized or altered input',async()=>{
    for(const request of [put(answers,{origin:'https://evil.test'}),put(answers,{'content-length':'9000'}),put({...answers,environment:'sandbox'})])expect((await PUT(request)).status).toBeGreaterThanOrEqual(400)
    expect(state.createSession).not.toHaveBeenCalled()
  })

  it('does not install the replacement cookie when prior-session revocation fails',async()=>{
    state.revokeSession.mockRejectedValueOnce(new Error('database unavailable'))
    const result=await PUT(put(answers,{cookie:'__Host-ev_giving_guest=guest-nonce; __Host-ev_giving_resume=prior-session'}))
    expect(result.status).toBe(400)
    expect(result.headers.get('set-cookie')).toBeNull()
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
    const request = new NextRequest('https://www.ev.church/api/giving/drafts?scope=flow', {
      method: 'DELETE',
      headers: { origin: 'https://www.ev.church', cookie: '__Host-ev_giving_resume=resume-token' },
    })
    const response = await DELETE(request)
    expect(response.status).toBe(200)
    expect(state.revokeSession).toHaveBeenCalledWith('resume-token')
    expect(response.headers.get('set-cookie')).toContain('__Host-ev_giving_resume=;')
    expect(response.headers.get('set-cookie')).toContain('__Host-ev_giving_checkout=;')
    expect(response.headers.get('set-cookie')).toContain('__Host-ev_giving_return=;')

    const denied = await DELETE(new NextRequest('https://www.ev.church/api/giving/drafts', { method: 'DELETE', headers: { origin: 'https://evil.test' } }))
    expect(denied.status).toBe(403)
    expect(state.revokeSession).toHaveBeenCalledTimes(1)
  })

  it('clears browser resume capabilities when server revocation is unavailable', async () => {
    state.revokeSession.mockRejectedValueOnce(new Error('database unavailable'))
    const response = await DELETE(new NextRequest('https://www.ev.church/api/giving/drafts?scope=flow', {
      method: 'DELETE',
      headers: { origin: 'https://www.ev.church', cookie: '__Host-ev_giving_resume=resume-token' },
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('__Host-ev_giving_resume=;')
    expect(response.headers.get('set-cookie')).toContain('__Host-ev_giving_checkout=;')
    expect(response.headers.get('set-cookie')).toContain('__Host-ev_giving_return=;')
  })

  it('preserves payment recovery capabilities during ordinary draft cleanup', async () => {
    const response = await DELETE(new NextRequest('https://www.ev.church/api/giving/drafts', {
      method: 'DELETE',
      headers: { origin: 'https://www.ev.church', cookie: '__Host-ev_giving_resume=resume-token' },
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain('__Host-ev_giving_resume=;')
    expect(response.headers.get('set-cookie')).not.toContain('__Host-ev_giving_checkout=;')
    expect(response.headers.get('set-cookie')).not.toContain('__Host-ev_giving_return=;')
  })
})
