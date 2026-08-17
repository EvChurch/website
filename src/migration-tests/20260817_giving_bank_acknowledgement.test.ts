import { describe, expect, it } from 'vitest'

import { migrations } from '../migrations'
import { GIVING_BANK_ACKNOWLEDGEMENT_DOWN_SQL, GIVING_BANK_ACKNOWLEDGEMENT_UP_SQL } from '../migrations/20260817_020000_giving_bank_acknowledgement'

describe('giving bank acknowledgement migration', () => {
  it('adds an auditable self-reported timestamp without changing payment status', () => {
    expect(GIVING_BANK_ACKNOWLEDGEMENT_UP_SQL).toContain('bank_setup_acknowledged_at timestamptz')
    expect(GIVING_BANK_ACKNOWLEDGEMENT_UP_SQL).not.toContain("status='completed'")
  })

  it('refuses destructive rollback after an acknowledgement and is registered', () => {
    expect(GIVING_BANK_ACKNOWLEDGEMENT_DOWN_SQL).toContain('Cannot roll back giving bank acknowledgement after acknowledgement activity')
    expect(migrations.at(-1)?.name).toBe('20260817_020000_giving_bank_acknowledgement')
  })
})
