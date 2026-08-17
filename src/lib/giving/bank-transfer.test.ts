import { describe, expect, it } from 'vitest'

import { givingBankCode, givingBankTransferDetails } from './bank-transfer'

describe('giving bank reconciliation details', () => {
  it('uses the first initial followed by the normalised surname', () => {
    expect(givingBankCode('Ada', 'Lovelace')).toBe('ALOVELACE')
    expect(givingBankCode(' Élodie ', " O'Connor-Smith ")).toBe('EOCONNORSMIT')
  })

  it('always emits a valid non-empty twelve-character bank code', () => {
    expect(givingBankCode('李', '王')).toBe('GIVER')
    expect(givingBankCode('Ada', 'Verylongfamilyname')).toHaveLength(12)
  })

  it('shares the same PCR values with direct bank instructions', () => {
    expect(givingBankTransferDetails('GENERAL', 'ALOVELACE', 'EV123')).toEqual({
      accountName: 'Auckland Evangelical Church Trust',
      accountNumber: '01-1845-0008260-05',
      particulars: 'GENERAL',
      code: 'ALOVELACE',
      reference: 'EV123',
    })
  })
})
