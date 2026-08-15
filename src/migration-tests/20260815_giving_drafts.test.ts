import { describe, expect, it, vi } from 'vitest'

import { GIVING_DRAFTS_DOWN_SQL, GIVING_DRAFTS_UP_SQL, down, up } from '../migrations/20260815_210000_giving_drafts'

describe('giving drafts migration', () => {
  it('creates a private digest-only capability table with a guarded down migration', () => {
    expect(GIVING_DRAFTS_UP_SQL).toContain('CREATE TABLE IF NOT EXISTS "giving_drafts"')
    expect(GIVING_DRAFTS_UP_SQL).toContain('"token_digest" varchar NOT NULL UNIQUE')
    expect(GIVING_DRAFTS_UP_SQL).not.toContain('"token" varchar')
    expect(GIVING_DRAFTS_UP_SQL).toContain('giving-draft-session-v1')
    expect(GIVING_DRAFTS_DOWN_SQL.indexOf('RAISE EXCEPTION')).toBeLessThan(GIVING_DRAFTS_DOWN_SQL.indexOf('DROP TABLE'))
  })

  it('executes both directions through the migration transaction', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    await up({ db: { execute } } as never)
    await down({ db: { execute } } as never)
    expect(execute).toHaveBeenCalledTimes(2)
  })
})
