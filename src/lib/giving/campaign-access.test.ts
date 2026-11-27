import { describe, expect, it } from 'vitest'
import { campaignGivingAccess, campaignPublicAccess } from './campaign-access'

describe('Give Sunday timed access flag', () => {
  it('restricts access until the first minute of Saturday in Auckland', () => {
    const before = new Date('2026-12-04T10:59:59.999Z')
    expect(campaignGivingAccess(false, before).allowed).toBe(false)
    expect(campaignGivingAccess(true, before).allowed).toBe(true)
    expect(campaignPublicAccess(before)).toBe(false)
  })
  it('opens to everyone at midnight Saturday, regardless of the host timezone', () => {
    const opening = new Date('2026-12-04T11:00:00.000Z')
    expect(campaignGivingAccess(false, opening)).toMatchObject({ allowed: true, publicAccess: true })
    expect(campaignGivingAccess(false, new Date('2026-12-05T10:59:59Z')).allowed).toBe(true)
  })
  it('fails closed for an invalid clock', () => {
    expect(campaignPublicAccess(new Date('invalid'))).toBe(false)
  })
})
