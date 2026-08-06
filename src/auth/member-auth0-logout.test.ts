import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const memberEnvironment = {
  MEMBER_AUTH0_APP_BASE_URL: 'https://www.ev.church',
  MEMBER_AUTH0_DOMAIN: 'members.example.test',
  MEMBER_AUTH0_CLIENT_ID: 'member-client',
  MEMBER_AUTH0_CLIENT_SECRET: 'member-secret',
  MEMBER_AUTH0_SECRET: 'b'.repeat(64),
  MEMBER_ROCK_API_URL: 'https://rock.example.test/api',
  MEMBER_ROCK_API_KEY: 'member-rock-key',
}

const originalFetch = global.fetch

describe('member Auth0 logout middleware', () => {
  afterEach(() => {
    global.fetch = originalFetch
    for (const name of Object.keys(memberEnvironment)) delete process.env[name]
    vi.resetModules()
  })

  it('uses absolute registered return destinations for OIDC logout', async () => {
    Object.assign(process.env, memberEnvironment)
    global.fetch = vi.fn(async () =>
      Response.json({
        issuer: 'https://members.example.test/',
        authorization_endpoint: 'https://members.example.test/authorize',
        token_endpoint: 'https://members.example.test/oauth/token',
        jwks_uri: 'https://members.example.test/.well-known/jwks.json',
        end_session_endpoint: 'https://members.example.test/oidc/logout',
      }),
    )

    const { getMemberAuth0Client } = await import('./member-auth0-client')
    const defaultResponse = await getMemberAuth0Client().middleware(
      new NextRequest('https://www.ev.church/member-auth/logout'),
    )
    const errorResponse = await getMemberAuth0Client().middleware(
      new NextRequest(
        'https://www.ev.church/member-auth/logout?returnTo=https%3A%2F%2Fwww.ev.church%2Fmember-sign-in%2Ferror',
      ),
    )

    const defaultLocation = new URL(defaultResponse.headers.get('location')!)
    const errorLocation = new URL(errorResponse.headers.get('location')!)
    expect(defaultLocation.origin + defaultLocation.pathname).toBe(
      'https://members.example.test/oidc/logout',
    )
    expect(defaultLocation.searchParams.get('post_logout_redirect_uri')).toBe(
      'https://www.ev.church/',
    )
    expect(errorLocation.searchParams.get('post_logout_redirect_uri')).toBe(
      'https://www.ev.church/member-sign-in/error',
    )
  })
})
