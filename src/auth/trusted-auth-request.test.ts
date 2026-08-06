import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { isTrustedAuthRequest } from './trusted-auth-request'

describe('Auth0 request origin', () => {
  beforeEach(() => {
    process.env.APP_BASE_URL = 'https://www.ev.church'
    process.env.AUTH0_DOMAIN = 'tenant.au.auth0.com'
    process.env.AUTH0_CLIENT_ID = 'client'
    process.env.AUTH0_CLIENT_SECRET = 'secret'
    process.env.AUTH0_SECRET = 'a'.repeat(64)
  })

  afterEach(() => {
    delete process.env.APP_BASE_URL
    delete process.env.AUTH0_DOMAIN
    delete process.env.AUTH0_CLIENT_ID
    delete process.env.AUTH0_CLIENT_SECRET
    delete process.env.AUTH0_SECRET
  })

  it('accepts the canonical same-origin request', () => {
    expect(
      isTrustedAuthRequest(
        new Headers({
          origin: 'https://www.ev.church',
          'sec-fetch-site': 'same-origin',
        }),
      ),
    ).toBe(true)
  })

  it('rejects cross-site and sibling-origin requests', () => {
    expect(
      isTrustedAuthRequest(new Headers({ origin: 'https://evil.example' })),
    ).toBe(false)
    expect(
      isTrustedAuthRequest(new Headers({ 'sec-fetch-site': 'cross-site' })),
    ).toBe(false)
    expect(
      isTrustedAuthRequest(new Headers({ origin: 'https://admin.ev.church' })),
    ).toBe(false)
  })
})
