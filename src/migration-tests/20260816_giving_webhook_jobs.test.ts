import { describe, expect, it } from 'vitest'
import { GIVING_WEBHOOK_JOBS_DOWN_SQL, GIVING_WEBHOOK_JOBS_UP_SQL, GIVING_WEBHOOK_JOB_SLUGS } from '../migrations/20260816_000000_giving_webhook_jobs'

describe('giving webhook jobs migration', () => {
  it('adds lifecycle links, provenance guards, count checks and both Payload job enums', () => {
    expect(GIVING_WEBHOOK_JOBS_UP_SQL).toContain('DROP CONSTRAINT IF EXISTS giving_gifts_checkout_unique')
    expect(GIVING_WEBHOOK_JOBS_UP_SQL).toContain('last_conflicting_digest')
    expect(GIVING_WEBHOOK_JOBS_UP_SQL).toContain("context_key='sandbox:unmatched' AND status='quarantined'")
    expect(GIVING_WEBHOOK_JOBS_UP_SQL).toContain('attempt_count >= 0')
    for (const slug of GIVING_WEBHOOK_JOB_SLUGS) {
      expect(GIVING_WEBHOOK_JOBS_UP_SQL.match(new RegExp(slug, 'g'))).toHaveLength(2)
      expect(GIVING_WEBHOOK_JOBS_DOWN_SQL).not.toContain(`DROP VALUE '${slug}'`)
    }
  })
})
