import { describe, expect, it } from 'vitest'

import { migrations } from '../migrations'
import { GIVING_BANK_CODE_DOWN_SQL, GIVING_BANK_CODE_UP_SQL } from '../migrations/20260817_010000_giving_bank_code'

describe('giving bank code migration', () => {
  it('adds, backfills and constrains the immutable checkout code', () => {
    expect(GIVING_BANK_CODE_UP_SQL).toContain("UPDATE giving_checkouts SET bank_code='GIVER' WHERE bank_code IS NULL")
    expect(GIVING_BANK_CODE_UP_SQL).toContain("CHECK(bank_code ~ '^[A-Z0-9]{1,12}$')")
    expect(GIVING_BANK_CODE_UP_SQL).toContain('ALTER COLUMN bank_code SET NOT NULL')
  })

  it('refuses destructive rollback after checkout activity and is registered', () => {
    expect(GIVING_BANK_CODE_DOWN_SQL).toContain('Cannot roll back giving bank code after checkout activity')
    expect(migrations.some((migration) => migration.name === '20260817_010000_giving_bank_code')).toBe(true)
  })
})
