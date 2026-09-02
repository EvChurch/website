import { describe, expect, it } from 'vitest'

import { createGivingDraftService, givingCapabilityCookieNames, GivingDraftCapabilityError, validateGivingDraftAnswers, type GivingDraftRecord } from './drafts'

function memoryStore() {
  const records: GivingDraftRecord[] = []
  return {
    records,
    async create(record: GivingDraftRecord) { records.push(record) },
    async read(input: { tokenDigest: string; bindingDigest: string; purpose: 'giving-draft-session-v1'; audience: 'guest' | 'member'; now: Date }) {
      const record = records.find((candidate) => candidate.tokenDigest === input.tokenDigest && candidate.bindingDigest === input.bindingDigest && candidate.purpose === input.purpose && candidate.audience === input.audience)
      if (!record || record.consumedAt || record.expiresAt <= input.now) return null
      return record
    },
    async revoke() {},
  }
}

const answers = { amountMinor: 5000, fundId: 2, fundConfirmed: true, frequency: 'monthly' as const, startDate: '2026-09-01', firstName: 'Alex', lastName: 'Taylor', email: 'alex@example.com' }

describe('giving draft capabilities', () => {
  it('uses Secure __Host capability names in HTTPS contexts with local-development fallbacks', () => {
    expect(givingCapabilityCookieNames(true)).toEqual({ guest: '__Host-ev_giving_guest', resume: '__Host-ev_giving_resume' })
    expect(givingCapabilityCookieNames(false)).toEqual({ guest: 'ev_giving_guest', resume: 'ev_giving_resume' })
  })
  it('stores only token and binding digests and reads the cookie-bound session', async () => {
    const store = memoryStore()
    const service = createGivingDraftService(store, { randomBytes: () => Buffer.alloc(32, 7), now: () => new Date('2026-08-15T00:00:00Z') })
    const created = await service.createSession({ answers, binding: { audience: 'guest', nonce: 'browser-nonce' } })
    expect(store.records[0]?.tokenDigest).not.toBe(created.token)
    expect(JSON.stringify(store.records[0])).not.toContain('browser-nonce')

    await expect(service.readSession({ token: created.token, binding: { audience: 'guest', nonce: 'browser-nonce' } })).resolves.toEqual(answers)
  })

  it('accepts a previous-release draft and discards its obsolete return path', () => {
    const { fundConfirmed: _fundConfirmed, ...previousAnswers } = answers
    expect(validateGivingDraftAnswers({ ...previousAnswers, returnPathname: '/events' })).toEqual(answers)
  })

  it('accepts partial progress while rejecting contradictory partial state', () => {
    expect(validateGivingDraftAnswers({ ...answers, fundId: null, fundConfirmed: false, frequency: null, startDate: null })).toEqual({
      ...answers,
      fundId: null,
      fundConfirmed: false,
      frequency: null,
      startDate: null,
    })
    expect(() => validateGivingDraftAnswers({ ...answers, fundId: null, fundConfirmed: true })).toThrow(GivingDraftCapabilityError)
    expect(() => validateGivingDraftAnswers({ ...answers, frequency: null })).toThrow(GivingDraftCapabilityError)
  })

  it.each([
    { audience: 'guest' as const, nonce: 'wrong-browser' },
    { audience: 'member' as const, subject: 'auth0|other' },
  ])('fails uniformly for an invalid binding', async (binding) => {
    const store = memoryStore()
    const service = createGivingDraftService(store, { randomBytes: () => Buffer.alloc(32, 8), now: () => new Date('2026-08-15T00:00:00Z') })
    const created = await service.createSession({ answers, binding: { audience: 'member', subject: 'auth0|member' } })
    await expect(service.readSession({ token: created.token, binding })).rejects.toBeInstanceOf(GivingDraftCapabilityError)
  })
})
