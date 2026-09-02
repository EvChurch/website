import { describe, expect, it } from 'vitest'

import { GIVING_TRANSACTION_FEES_DOWN_SQL, GIVING_TRANSACTION_FEES_UP_SQL } from '../migrations/20260903_010000_giving_transaction_fees'
import { migrations } from '../migrations'

describe('giving transaction fees migration', () => {
  it('adds a configurable fee and zero-backed snapshots for historical payment records', () => {
    expect(GIVING_TRANSACTION_FEES_UP_SQL).toContain('CREATE TABLE IF NOT EXISTS "giving_settings"')
    expect(GIVING_TRANSACTION_FEES_UP_SQL).toContain('"transaction_fee_minor" numeric NOT NULL DEFAULT 50')
    expect(GIVING_TRANSACTION_FEES_UP_SQL.match(/ADD COLUMN "transaction_fee_minor" numeric NOT NULL DEFAULT 0/g)).toHaveLength(3)
  })

  it('refuses to discard fee-bearing financial history', () => {
    expect(GIVING_TRANSACTION_FEES_DOWN_SQL).toContain('Cannot roll back giving transaction fees after fee-bearing activity')
  })

  it('registers after the existing migrations', () => {
    expect(migrations.at(-1)?.name).toBe('20260903_010000_giving_transaction_fees')
  })
})
