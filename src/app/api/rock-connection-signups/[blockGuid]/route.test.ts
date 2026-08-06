import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createRockConnectionContextToken, type RockConnectionContext } from '@/lib/rock-connection-signups/context-token'
import { createMemoryNonceStore, digestConnectionNonce } from '@/lib/rock-connection-signups/nonce-store'
import { createMemoryRateLimitStore } from '@/lib/rock-connection-signups/rate-limit'
import { RockConnectionSignupOutcomeUnknownError } from '@/lib/rock-connection-signups/server'
import type { RockConnectionSignupSchema } from '@/lib/rock-connection-signups/types'
import { TurnstileVerificationError } from '@/lib/turnstile'

const {
  verifyTurnstileToken,
  isRockConnectionSignupPublished,
  initializeRockConnectionSignup,
  sendRockConnectionSignup,
} = vi.hoisted(() => ({
  verifyTurnstileToken: vi.fn(),
  isRockConnectionSignupPublished: vi.fn(),
  initializeRockConnectionSignup: vi.fn(),
  sendRockConnectionSignup: vi.fn(),
}))

vi.mock('@/lib/turnstile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/turnstile')>()),
  verifyTurnstileToken,
}))
vi.mock('@/lib/rock-connection-signups/published', () => ({ isRockConnectionSignupPublished }))
vi.mock('@/lib/rock-connection-signups/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rock-connection-signups/server')>()),
  initializeRockConnectionSignup,
  sendRockConnectionSignup,
}))

import {
  handlePost,
  ROCK_CONNECTION_START_ACTION,
  ROCK_CONNECTION_SUBMIT_ACTION,
} from './handler'

const blockGuid = '70f9eb00-5961-42bc-b1ea-dbcb8fce6369'
const pageGuid = 'eab9cb2b-474f-4939-b665-e32b4d2e1bb2'
const opportunityGuid = '11111111-1111-4111-8111-111111111111'
const now = Date.now()

function schema(): RockConnectionSignupSchema {
  return {
    pageGuid,
    blockGuid,
    blockTypeGuid: '35d5ef65-0b0d-4e99-82b5-3f5fc2e0344f',
    opportunityGuid,
    opportunityName: 'Newish',
    sessionGuid: '22222222-2222-4222-8222-222222222222',
    interactionGuid: '33333333-3333-4333-8333-333333333333',
    attributes: [],
    campuses: [{ value: '3', text: 'Central' }],
    commentFieldLabel: 'Comments',
    disableCaptchaSupport: true,
    displayHomePhone: false,
    displayMobilePhone: true,
    selectedCampusId: 3,
    firstName: '',
    lastName: '',
    email: '',
    homePhone: null,
    mobilePhone: null,
  }
}

function signedContext(overrides: Partial<RockConnectionContext> = {}): RockConnectionContext {
  return {
    version: 1,
    purpose: 'rock-connection-signup',
    audience: 'ev.church',
    pageGuid,
    blockGuid,
    opportunityGuid,
    sessionGuid: '22222222-2222-4222-8222-222222222222',
    interactionGuid: '33333333-3333-4333-8333-333333333333',
    nonce: 'abcdefghijklmnopqrstuvwx',
    campuses: ['3'],
    selectedCampusId: 3,
    displayHomePhone: false,
    displayMobilePhone: true,
    attributes: [],
    issuedAt: now,
    expiresAt: now + 300_000,
    ...overrides,
  }
}

function request(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
  url = `https://www.ev.church/api/rock-connection-signups/${blockGuid}`,
) {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://www.ev.church',
      'cf-connecting-ip': '203.0.113.1',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

function context() {
  return { params: Promise.resolve({ blockGuid }) }
}

describe('public Rock Connection signup route', () => {
  beforeEach(() => {
    vi.stubEnv('ROCK_CONNECTION_CONTEXT_KEYS', `current:${Buffer.alloc(32, 7).toString('base64')}`)
    vi.stubEnv('ROCK_CONNECTION_RATE_LIMIT_SECRET', 'a'.repeat(32))
    vi.stubEnv('ROCK_CONNECTION_TRUST_CF_CONNECTING_IP', 'true')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RAILWAY_PUBLIC_DOMAIN', 'www.ev.church')
    verifyTurnstileToken.mockResolvedValue(undefined)
    isRockConnectionSignupPublished.mockResolvedValue(true)
    initializeRockConnectionSignup.mockResolvedValue(schema())
    sendRockConnectionSignup.mockResolvedValue({ resultType: 0, responseMessage: '<strong>Thanks</strong>' })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('checks Turnstile with the start action before touching Rock and stores a one-use context', async () => {
    const nonceStore = createMemoryNonceStore()
    const response = await handlePost(
      request({ intent: 'start', turnstileToken: 'fresh-start' }),
      context(),
      { nonceStore, rateLimitStore: createMemoryRateLimitStore() },
    )
    expect(response.status).toBe(200)
    expect(verifyTurnstileToken).toHaveBeenCalledWith(expect.objectContaining({
      token: 'fresh-start', expectedAction: ROCK_CONNECTION_START_ACTION,
      expectedHostname: 'www.ev.church', remoteIp: '203.0.113.1',
    }))
    expect(verifyTurnstileToken.mock.invocationCallOrder[0]).toBeLessThan(initializeRockConnectionSignup.mock.invocationCallOrder[0])
    const result = await response.json()
    expect(result.schema).not.toHaveProperty('sessionGuid')
    expect(result.schema).not.toHaveProperty('interactionGuid')
    expect(result.contextToken).toEqual(expect.any(String))
  })

  it('uses the Railway public hostname for Turnstile behind the production proxy', async () => {
    vi.stubEnv('RAILWAY_PUBLIC_DOMAIN', 'new.ev.church')
    const response = await handlePost(
      request(
        { intent: 'start', turnstileToken: 'fresh-start' },
        { origin: 'https://new.ev.church' },
        `https://0.0.0.0:3000/api/rock-connection-signups/${blockGuid}`,
      ),
      context(),
      { nonceStore: createMemoryNonceStore(), rateLimitStore: createMemoryRateLimitStore() },
    )

    expect(response.status).toBe(200)
    expect(verifyTurnstileToken).toHaveBeenCalledWith(
      expect.objectContaining({ expectedHostname: 'new.ev.church' }),
    )
  })

  it('rejects cross-origin and invalid Turnstile requests before Rock', async () => {
    let response = await handlePost(
      request({ intent: 'start', turnstileToken: 'token' }, { origin: 'https://evil.test' }),
      context(),
      { nonceStore: createMemoryNonceStore(), rateLimitStore: createMemoryRateLimitStore() },
    )
    expect(response.status).toBe(403)
    expect(verifyTurnstileToken).not.toHaveBeenCalled()

    verifyTurnstileToken.mockRejectedValueOnce(new TurnstileVerificationError('The bot check expired or could not be verified'))
    response = await handlePost(
      request({ intent: 'start', turnstileToken: 'bad' }), context(),
      { nonceStore: createMemoryNonceStore(), rateLimitStore: createMemoryRateLimitStore() },
    )
    expect(response.status).toBe(400)
    expect(initializeRockConnectionSignup).not.toHaveBeenCalled()
  })

  it('validates before consuming, then sends the exact initialized context once', async () => {
    const nonceStore = createMemoryNonceStore()
    const signed = signedContext()
    await nonceStore.create({
      nonceDigest: digestConnectionNonce(signed.nonce), purpose: signed.purpose,
      pageGuid, blockGuid, expiresAt: new Date(signed.expiresAt),
    })
    const token = createRockConnectionContextToken(signed)
    const dependencies = { nonceStore, rateLimitStore: createMemoryRateLimitStore() }

    const invalid = await handlePost(request({
      intent: 'submit', turnstileToken: 'first', contextToken: token,
      values: { firstName: 'Ada', lastName: 'Lovelace', email: 'bad' },
    }), context(), dependencies)
    expect(invalid.status).toBe(400)
    expect(sendRockConnectionSignup).not.toHaveBeenCalled()

    const valid = await handlePost(request({
      intent: 'submit', turnstileToken: 'second', contextToken: token,
      values: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', campusId: 3 },
    }), context(), dependencies)
    expect(valid.status).toBe(200)
    expect(verifyTurnstileToken).toHaveBeenLastCalledWith(expect.objectContaining({ expectedAction: ROCK_CONNECTION_SUBMIT_ACTION }))
    expect(sendRockConnectionSignup).toHaveBeenCalledTimes(1)
    expect(sendRockConnectionSignup).toHaveBeenCalledWith({
      pageGuid, blockGuid,
      sessionGuid: signed.sessionGuid, interactionGuid: signed.interactionGuid,
      bag: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', campusId: 3 },
    })
    await expect(valid.json()).resolves.toMatchObject({ status: 'complete', resultType: 0, message: 'Thanks' })

    const replay = await handlePost(request({
      intent: 'submit', turnstileToken: 'third', contextToken: token,
      values: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', campusId: 3 },
    }), context(), dependencies)
    expect(replay.status).toBe(409)
    await expect(replay.json()).resolves.toMatchObject({ restartRequired: true })
    expect(sendRockConnectionSignup).toHaveBeenCalledTimes(1)
  })

  it('permits only one concurrent dispatch for a context', async () => {
    const nonceStore = createMemoryNonceStore()
    const signed = signedContext()
    await nonceStore.create({ nonceDigest: digestConnectionNonce(signed.nonce), purpose: signed.purpose, pageGuid, blockGuid, expiresAt: new Date(signed.expiresAt) })
    const token = createRockConnectionContextToken(signed)
    const dependencies = { nonceStore, rateLimitStore: createMemoryRateLimitStore() }
    const body = { intent: 'submit', turnstileToken: 'fresh', contextToken: token, values: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test' } }
    const results = await Promise.all([
      handlePost(request(body), context(), dependencies),
      handlePost(request({ ...body, turnstileToken: 'other' }), context(), dependencies),
    ])
    expect(results.map(({ status }) => status).sort()).toEqual([200, 409])
    expect(sendRockConnectionSignup).toHaveBeenCalledTimes(1)
  })

  it('consumes the nonce when dispatch times out and reports an unknown outcome', async () => {
    const nonceStore = createMemoryNonceStore()
    const signed = signedContext()
    await nonceStore.create({ nonceDigest: digestConnectionNonce(signed.nonce), purpose: signed.purpose, pageGuid, blockGuid, expiresAt: new Date(signed.expiresAt) })
    const token = createRockConnectionContextToken(signed)
    const dependencies = { nonceStore, rateLimitStore: createMemoryRateLimitStore() }
    const body = { intent: 'submit', turnstileToken: 'fresh', contextToken: token, values: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test' } }
    sendRockConnectionSignup.mockRejectedValueOnce(new RockConnectionSignupOutcomeUnknownError())

    const timedOut = await handlePost(request(body), context(), dependencies)
    expect(timedOut.status).toBe(504)
    await expect(timedOut.json()).resolves.toMatchObject({ outcomeUnknown: true })

    const replay = await handlePost(request({ ...body, turnstileToken: 'new-token' }), context(), dependencies)
    expect(replay.status).toBe(409)
    expect(sendRockConnectionSignup).toHaveBeenCalledTimes(1)
  })

  it('rechecks publication and the current Rock identity before validation or dispatch', async () => {
    const signed = signedContext()
    const nonceStore = createMemoryNonceStore()
    await nonceStore.create({ nonceDigest: digestConnectionNonce(signed.nonce), purpose: signed.purpose, pageGuid, blockGuid, expiresAt: new Date(signed.expiresAt) })
    initializeRockConnectionSignup.mockResolvedValueOnce({ ...schema(), opportunityGuid: '99999999-9999-4999-8999-999999999999' })
    const response = await handlePost(request({
      intent: 'submit', turnstileToken: 'fresh', contextToken: createRockConnectionContextToken(signed), values: {},
    }), context(), { nonceStore, rateLimitStore: createMemoryRateLimitStore() })
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ restartRequired: true })
    expect(sendRockConnectionSignup).not.toHaveBeenCalled()
  })
})
