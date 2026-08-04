import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createRockConnectionContextToken,
  verifyRockConnectionContextToken,
  type RockConnectionContext,
} from './context-token'

const now = 1_800_000_000_000
const secret = Buffer.alloc(32, 7).toString('base64')
const previous = Buffer.alloc(32, 8).toString('base64')

function context(
  overrides: Partial<RockConnectionContext> = {},
): RockConnectionContext {
  return {
    version: 1,
    purpose: 'rock-connection-signup',
    audience: 'ev.church',
    pageGuid: 'eab9cb2b-474f-4939-b665-e32b4d2e1bb2',
    blockGuid: '70f9eb00-5961-42bc-b1ea-dbcb8fce6369',
    opportunityGuid: '11111111-1111-4111-8111-111111111111',
    sessionGuid: '22222222-2222-4222-8222-222222222222',
    interactionGuid: '33333333-3333-4333-8333-333333333333',
    nonce: 'abcdefghijklmnopqrstuvwx',
    campuses: ['3'],
    selectedCampusId: 3,
    displayHomePhone: true,
    displayMobilePhone: true,
    attributes: [],
    issuedAt: now,
    expiresAt: now + 300_000,
    ...overrides,
  }
}

describe('Rock Connection context tokens', () => {
  beforeEach(() => {
    vi.stubEnv(
      'ROCK_CONNECTION_CONTEXT_KEYS',
      `current:${secret},previous:${previous}`,
    )
  })

  afterEach(() => vi.unstubAllEnvs())

  it('signs with the first key and verifies during a bounded rotation overlap', () => {
    const token = createRockConnectionContextToken(context(), now)
    expect(
      JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()),
    ).toMatchObject({
      alg: 'HS256',
      kid: 'current',
      typ: 'ROCK-CONNECTION-CONTEXT',
    })
    expect(verifyRockConnectionContextToken(token, now)).toEqual(context())

    vi.stubEnv(
      'ROCK_CONNECTION_CONTEXT_KEYS',
      `next:${previous},current:${secret}`,
    )
    expect(verifyRockConnectionContextToken(token, now)).toEqual(context())
  })

  it('rejects tampered, expired, and future tokens', () => {
    const token = createRockConnectionContextToken(context(), now)
    expect(() =>
      verifyRockConnectionContextToken(`${token.slice(0, -1)}x`, now),
    ).toThrow('Invalid connection context')

    const expired = createRockConnectionContextToken(
      context({ issuedAt: now - 400_000, expiresAt: now - 1 }),
      now - 300_000,
    )
    expect(() => verifyRockConnectionContextToken(expired, now)).toThrow(
      'Invalid connection context',
    )

    const future = createRockConnectionContextToken(
      context({ issuedAt: now + 31_000, expiresAt: now + 100_000 }),
      now + 31_000,
    )
    expect(() => verifyRockConnectionContextToken(future, now)).toThrow(
      'Invalid connection context',
    )
  })

  it('refuses to create cross-protocol or cross-audience tokens', () => {
    expect(() =>
      createRockConnectionContextToken(
        { ...context(), purpose: 'rock-form' as never },
        now,
      ),
    ).toThrow('Invalid connection context')
    expect(() =>
      createRockConnectionContextToken(
        { ...context(), audience: 'other' as never },
        now,
      ),
    ).toThrow('Invalid connection context')
  })

  it('uses a development-only signing key when none is configured', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ROCK_CONNECTION_CONTEXT_KEYS', '')

    const token = createRockConnectionContextToken(context(), now)
    expect(verifyRockConnectionContextToken(token, now)).toEqual(context())
  })

  it('requires an explicit signing key in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ROCK_CONNECTION_CONTEXT_KEYS', '')

    expect(() => createRockConnectionContextToken(context(), now)).toThrow(
      'ROCK_CONNECTION_CONTEXT_KEYS is required',
    )
  })

  it('rejects unknown fields, algorithm confusion, unknown keys, and oversized input', () => {
    const token = createRockConnectionContextToken(context(), now)
    const [rawHeader, rawPayload, signature] = token.split('.')
    const header = JSON.parse(Buffer.from(rawHeader, 'base64url').toString())
    const payload = JSON.parse(Buffer.from(rawPayload, 'base64url').toString())
    const variants = [
      `${Buffer.from(JSON.stringify({ ...header, alg: 'none' })).toString('base64url')}.${rawPayload}.${signature}`,
      `${Buffer.from(JSON.stringify({ ...header, kid: 'missing' })).toString('base64url')}.${rawPayload}.${signature}`,
      `${rawHeader}.${Buffer.from(JSON.stringify({ ...payload, surprise: true })).toString('base64url')}.${signature}`,
      'x'.repeat(100_000),
    ]
    for (const variant of variants) {
      expect(() => verifyRockConnectionContextToken(variant, now)).toThrow(
        'Invalid connection context',
      )
    }
  })
})
