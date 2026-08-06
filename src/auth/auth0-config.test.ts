import { afterEach, describe, expect, it } from 'vitest'

import { readAuth0Config } from './auth0-config'

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
