import { afterEach, describe, expect, it } from 'vitest'

import { isMemberAuthEnabled } from './member-auth0-config'
import { readMemberRockConfig } from './member-rock-config'

const auth0Config = {
  APP_BASE_URL: 'https://www.ev.church',
  AUTH0_DOMAIN: 'auth.ev.church',
  AUTH0_SECRET: 'a'.repeat(64),
  AUTH0_CLIENT_ID: 'site-client-id',
  AUTH0_CLIENT_SECRET: 'site-client-secret',
  ROCK_API_URL: 'https://shared-rock.example/api',
  ROCK_API_KEY: 'shared-rock-key',
}

describe('member authentication configuration', () => {
  afterEach(() => {
    for (const key of Object.keys(auth0Config)) {
      delete process.env[key]
    }
  })

  it('uses the existing Auth0 and Rock configuration', () => {
    Object.assign(process.env, auth0Config)

    expect(readMemberRockConfig()).toEqual({
      apiKey: 'shared-rock-key',
      apiUrl: 'https://shared-rock.example/api',
    })
    expect(isMemberAuthEnabled()).toBe(true)
  })

  it('requires the existing Auth0 and Rock settings', () => {
    Object.assign(process.env, auth0Config)
    delete process.env.ROCK_API_URL

    expect(isMemberAuthEnabled()).toBe(false)
    expect(() => readMemberRockConfig()).toThrow('ROCK_API_URL')

    Object.assign(process.env, auth0Config)
    delete process.env.AUTH0_CLIENT_ID
    expect(isMemberAuthEnabled()).toBe(false)
  })

  it('stays disabled for partial or placeholder configuration', () => {
    Object.assign(process.env, auth0Config, {
      ROCK_API_KEY: '',
    })
    expect(isMemberAuthEnabled()).toBe(false)

    Object.assign(process.env, auth0Config, {
      AUTH0_SECRET: 'change-me',
    })
    expect(isMemberAuthEnabled()).toBe(false)
  })
})
