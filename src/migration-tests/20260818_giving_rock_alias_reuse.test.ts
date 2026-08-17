import { describe, expect, it } from 'vitest'

import { migrations } from '../migrations'
import {
  GIVING_ROCK_ALIAS_REUSE_DOWN_SQL,
  GIVING_ROCK_ALIAS_REUSE_UP_SQL,
} from '../migrations/20260818_010000_giving_rock_alias_reuse'

describe('giving Rock alias reuse migration', () => {
  it('keeps provider identifiers unique for BlinkPay but reusable for Rock identity', () => {
    expect(GIVING_ROCK_ALIAS_REUSE_UP_SQL).toContain("provider='blinkpay'")
    expect(GIVING_ROCK_ALIAS_REUSE_UP_SQL).not.toContain("provider='rock'")
  })

  it('refuses to restore global uniqueness once a Rock alias has been reused and is registered', () => {
    expect(GIVING_ROCK_ALIAS_REUSE_DOWN_SQL).toContain('Cannot restore global provider ID uniqueness')
    expect(migrations.some((migration) => migration.name === '20260818_010000_giving_rock_alias_reuse')).toBe(true)
  })
})
