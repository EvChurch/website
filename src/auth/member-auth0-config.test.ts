import { afterEach, describe, expect, it } from 'vitest'

import {
  isMemberAuthEnabled,
  readMemberAuth0Config,
} from './member-auth0-config'
import { readMemberRockConfig } from './member-rock-config'

const memberConfig = {
  MEMBER_AUTH0_APP_BASE_URL: 'https://www.ev.church',
  MEMBER_AUTH0_DOMAIN: 'members.au.auth0.com',
  MEMBER_AUTH0_CLIENT_ID: 'member-client-id',
  MEMBER_AUTH0_CLIENT_SECRET: 'member-client-secret',
  MEMBER_AUTH0_SECRET: 'b'.repeat(64),
  MEMBER_ROCK_API_URL: 'https://rock.ev.church/api',
  MEMBER_ROCK_API_KEY: 'member-rock-key',
}

const adminConfig = {
  APP_BASE_URL: 'https://admin.ev.church',
  AUTH0_DOMAIN: 'admin.au.auth0.com',
  AUTH0_CLIENT_ID: 'admin-client-id',
  AUTH0_CLIENT_SECRET: 'admin-client-secret',
  AUTH0_SECRET: 'a'.repeat(64),
  ROCK_API_URL: 'https://shared-rock.example/api',
  ROCK_API_KEY: 'shared-rock-key',
}

describe('member authentication configuration', () => {
  afterEach(() => {
    for (const key of [...Object.keys(memberConfig), ...Object.keys(adminConfig)]) {
      delete process.env[key]
    }
  })

  it('reads only the explicit member Auth0 and Rock settings', () => {
    Object.assign(process.env, adminConfig, memberConfig)

    expect(readMemberAuth0Config()).toMatchObject({
      appBaseUrl: 'https://www.ev.church',
      clientId: 'member-client-id',
      domain: 'members.au.auth0.com',
      issuer: 'https://members.au.auth0.com/',
      secret: 'b'.repeat(64),
    })
    expect(readMemberRockConfig()).toEqual({
      apiKey: 'member-rock-key',
      apiUrl: 'https://rock.ev.church/api',
    })
    expect(isMemberAuthEnabled()).toBe(true)
  })

  it('never falls back to admin Auth0 or shared Rock settings', () => {
    Object.assign(process.env, adminConfig)

    expect(isMemberAuthEnabled()).toBe(false)
    expect(() => readMemberAuth0Config()).toThrow('MEMBER_AUTH0_')
    expect(() => readMemberRockConfig()).toThrow('MEMBER_ROCK_API_URL')
  })

  it('stays disabled for partial or placeholder configuration', () => {
    Object.assign(process.env, memberConfig, {
      MEMBER_ROCK_API_KEY: '',
    })
    expect(isMemberAuthEnabled()).toBe(false)

    Object.assign(process.env, memberConfig, {
      MEMBER_AUTH0_SECRET: 'change-me',
    })
    expect(isMemberAuthEnabled()).toBe(false)
  })
})
