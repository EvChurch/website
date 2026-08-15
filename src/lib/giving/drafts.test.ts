import { describe, expect, it } from 'vitest'

import { createGivingDraftService, givingCapabilityCookieNames, givingResumeRedirectUrl, GivingDraftCapabilityError, type GivingDraftRecord } from './drafts'

function memoryStore() {
  const records: GivingDraftRecord[] = []
  return {
    records,
    async create(record: GivingDraftRecord) { records.push(record) },
    async redeem(input: { tokenDigest: string; bindingDigest: string; purpose: 'giving-draft-resume-v1'; audience: 'guest' | 'member'; now: Date }) {
      const record = records.find((candidate) => candidate.tokenDigest === input.tokenDigest && candidate.bindingDigest === input.bindingDigest && candidate.purpose === input.purpose && candidate.audience === input.audience)
      if (!record || record.consumedAt || record.expiresAt <= input.now) return null
      record.consumedAt = input.now
      return record
    },
    async read() { return null },
    async revoke() {},
  }
}

const answers = { amountMinor: 5000, fundId: 2, frequency: 'monthly' as const, startDate: '2026-09-01', firstName: 'Alex', lastName: 'Taylor', email: 'alex@example.com', returnPathname: '/events' }

describe('giving draft capabilities', () => {
  it('uses Secure __Host capability names in HTTPS contexts with local-development fallbacks', () => {
    expect(givingCapabilityCookieNames(true)).toEqual({ guest: '__Host-ev_giving_guest', resume: '__Host-ev_giving_resume' })
    expect(givingCapabilityCookieNames(false)).toEqual({ guest: 'ev_giving_guest', resume: 'ev_giving_resume' })
  })
  it('stores only token and binding digests and redeems once for the intended audience', async () => {
    const store = memoryStore()
    const service = createGivingDraftService(store, { randomBytes: () => Buffer.alloc(32, 7), now: () => new Date('2026-08-15T00:00:00Z') })
    const created = await service.create({ answers, binding: { audience: 'guest', nonce: 'browser-nonce' } })
    expect(store.records[0]?.tokenDigest).not.toBe(created.token)
    expect(JSON.stringify(store.records[0])).not.toContain('browser-nonce')

    await expect(service.redeem({ token: created.token, binding: { audience: 'guest', nonce: 'browser-nonce' } })).resolves.toEqual(answers)
    await expect(service.redeem({ token: created.token, binding: { audience: 'guest', nonce: 'browser-nonce' } })).rejects.toBeInstanceOf(GivingDraftCapabilityError)
  })

  it.each(['/events?campus=2', '/give', '/api/private', '//evil.test'])('rejects unsafe original pathname %s', async (returnPathname) => {
    const store = memoryStore()
    const service = createGivingDraftService(store, { randomBytes: () => Buffer.alloc(32, 9) })
    await expect(service.create({ answers: { ...answers, returnPathname }, binding: { audience: 'guest', nonce: 'browser' } })).rejects.toBeInstanceOf(GivingDraftCapabilityError)
  })

  it('returns to the original clean public pathname without capability or answer data', () => {
    expect(givingResumeRedirectUrl('https://www.ev.church/give/resume/secret', '/events').toString()).toBe('https://www.ev.church/events')
    expect(givingResumeRedirectUrl('https://www.ev.church/give/resume/secret', '/privacy').toString()).toBe('https://www.ev.church/privacy')
  })

  it.each([
    { audience: 'guest' as const, nonce: 'wrong-browser' },
    { audience: 'member' as const, subject: 'auth0|other' },
  ])('fails uniformly for an invalid binding', async (binding) => {
    const store = memoryStore()
    const service = createGivingDraftService(store, { randomBytes: () => Buffer.alloc(32, 8), now: () => new Date('2026-08-15T00:00:00Z') })
    const created = await service.create({ answers, binding: { audience: 'member', subject: 'auth0|member' } })
    await expect(service.redeem({ token: created.token, binding })).rejects.toBeInstanceOf(GivingDraftCapabilityError)
  })
})
