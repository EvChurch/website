import { afterEach, describe, expect, it, vi } from 'vitest'

import { givingSubmissionVersion, requireCurrentGivingSubmission } from './submission-version'
import { GET } from '@/app/api/giving/session/route'

describe('giving credential cutover admission', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('changes the public version with the key and rejects old versions after cutover', () => {
    vi.stubEnv('GIVING_ACQUISITION_PAUSED', 'false')
    vi.stubEnv('GIVING_CHECKOUT_DIGEST_SECRET', 'a'.repeat(32))
    const previous = givingSubmissionVersion()!
    const headers = new Headers({ 'x-ev-giving-version': previous })
    expect(() => requireCurrentGivingSubmission(headers)).not.toThrow()
    vi.stubEnv('GIVING_CHECKOUT_DIGEST_SECRET', 'b'.repeat(32))
    expect(givingSubmissionVersion()).not.toBe(previous)
    expect(() => requireCurrentGivingSubmission(headers)).toThrow(expect.objectContaining({ reason: 'restart' }))
    expect(() => requireCurrentGivingSubmission(new Headers())).toThrow()
    expect(() => requireCurrentGivingSubmission(new Headers({ 'x-ev-giving-version': givingSubmissionVersion()! }))).not.toThrow()
  })

  it('serves an uncached runtime version and fails closed during a pause or missing configuration', async () => {
    vi.stubEnv('GIVING_CHECKOUT_DIGEST_SECRET', 'a'.repeat(32))
    vi.stubEnv('GIVING_ACQUISITION_PAUSED', 'false')
    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(await response.json()).toEqual({ version: givingSubmissionVersion() })
    vi.stubEnv('GIVING_ACQUISITION_PAUSED', 'true')
    expect((await GET()).status).toBe(503)
    expect(() => requireCurrentGivingSubmission(new Headers())).toThrow(expect.objectContaining({ reason: 'paused' }))
    vi.stubEnv('GIVING_ACQUISITION_PAUSED', 'false')
    vi.stubEnv('GIVING_CHECKOUT_DIGEST_SECRET', '')
    expect((await GET()).status).toBe(503)
    expect(givingSubmissionVersion()).toBeNull()
  })
})
