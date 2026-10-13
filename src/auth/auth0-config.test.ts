import { afterEach, describe, expect, it } from 'vitest'

import { readAuth0Config } from './auth0-config'
import { auth0IdentityKey } from './auth0-identity'

const valid = {
  AUTH0_DOMAIN: 'tenant.au.auth0.com',
  AUTH0_CLIENT_ID: 'client-id',
  AUTH0_CLIENT_SECRET: 'client-secret',
  AUTH0_SECRET: 'a'.repeat(64),
  APP_BASE_URL: 'https://www.ev.church',
}

describe('Auth0 runtime configuration', () => {
  afterEach(() => {
    for (const key of Object.keys(valid)) delete process.env[key]
    delete process.env.AUTH0_IDENTITY_ISSUER
  })

  it('preserves existing Payload identity keys when login moves to a custom domain', () => {
    Object.assign(process.env, valid)
    const previous = readAuth0Config()
    const existingKey = auth0IdentityKey(previous.issuer, 'auth0|test-user')

    Object.assign(process.env, {
      AUTH0_DOMAIN: 'auth.ev.church',
      AUTH0_IDENTITY_ISSUER: previous.issuer,
    })
    const customDomain = readAuth0Config()

    expect(customDomain.domain).toBe('auth.ev.church')
    expect(customDomain.issuer).toBe(previous.issuer)
    expect(auth0IdentityKey(customDomain.issuer, 'auth0|test-user')).toBe(existingKey)
    expect(auth0IdentityKey(customDomain.issuer, 'auth0|another-user')).not.toBe(existingKey)
  })

  it.each([
    'http://tenant.au.auth0.com/',
    'https://tenant.au.auth0.com/path',
    'https://tenant.au.auth0.com/?query=1',
    'https://tenant.au.auth0.com/#fragment',
    'https://user:password@tenant.au.auth0.com/',
    'not-a-url',
  ])('rejects invalid identity issuer %s', (issuer) => {
    Object.assign(process.env, valid, { AUTH0_IDENTITY_ISSUER: issuer })
    expect(() => readAuth0Config()).toThrow('AUTH0_IDENTITY_ISSUER')
  })

  it('normalizes a fixed issuer and application origin', () => {
    Object.assign(process.env, valid)
    expect(readAuth0Config()).toMatchObject({
      issuer: 'https://tenant.au.auth0.com/',
      appBaseUrl: 'https://www.ev.church',
    })
  })

  it('rejects placeholders, malformed secrets, and base URLs with paths', () => {
    Object.assign(process.env, valid, { AUTH0_SECRET: 'change-me' })
    expect(() => readAuth0Config()).toThrow()

    Object.assign(process.env, valid, { APP_BASE_URL: 'https://www.ev.church/admin' })
    expect(() => readAuth0Config()).toThrow('origin')
  })
})
