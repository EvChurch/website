import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createRockFormContextToken,
  verifyRockFormContextToken,
} from './context-token'
import type { RockFormContext } from './types'

function context(overrides: Partial<RockFormContext> = {}): RockFormContext {
  return {
    version: 1,
    workflowTypeGuid: '874418b5-a477-4382-94dc-38060b005bfa',
    workflowGuid: null,
    sessionGuid: '11111111-1111-4111-8111-111111111111',
    interactionGuid: '22222222-2222-4222-8222-222222222222',
    actionTypeGuid: '33333333-3333-4333-8333-333333333333',
    actionStartDateTime: '2026-08-03T10:00:00+12:00',
    initialFieldValues: {},
    allowedFields: [],
    buttonTitles: ['Submit'],
    expiresAt: Date.now() + 60_000,
    ...overrides,
  }
}

describe('Rock form context tokens', () => {
  beforeEach(() => {
    process.env.ROCK_FORM_SIGNING_SECRET = 'test-only-secret'
  })

  afterEach(() => {
    delete process.env.ROCK_FORM_SIGNING_SECRET
  })

  it('round trips trusted Rock action state', () => {
    const value = context()
    expect(verifyRockFormContextToken(createRockFormContextToken(value))).toEqual(value)
  })

  it('rejects tampering', () => {
    const token = createRockFormContextToken(context())
    expect(() => verifyRockFormContextToken(`x${token.slice(1)}`)).toThrow(
      'Invalid form context',
    )
  })

  it('rejects expired contexts', () => {
    const token = createRockFormContextToken(context({ expiresAt: Date.now() - 1 }))
    expect(() => verifyRockFormContextToken(token)).toThrow(
      'Expired or invalid form context',
    )
  })
})
