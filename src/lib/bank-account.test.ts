import { expect, it } from 'vitest'
import { formatBankAccountNumber, isBankAccountNumber } from './bank-account'

it.each([
  ['1', '1'], ['12', '12'], ['121', '12-1'], ['1212341', '12-1234-1'],
  ['121234123456700', '12-1234-1234567-00'],
  ['1212341234567000', '12-1234-1234567-000'],
  ['12-1234-1234567-00', '12-1234-1234567-00'],
  ['12-1234-1234567-000', '12-1234-1234567-000'],
])('formats %s as %s', (input, output) => expect(formatBankAccountNumber(input)).toBe(output))

it.each(['12-1234-1234567-00', '12-1234-1234567-000'])('accepts %s', value => expect(isBankAccountNumber(value)).toBe(true))
it.each(['', '1212341234567000', '12-1234-1234567-0', '12-1234-1234567-0000', '1-1234-1234567-000', '12-123-1234567-000', '12-1234-123456-000', '12-1234-1234567-00x', ' 12-1234-1234567-000', '12-1234-1234567-000\n'])('rejects %j', value => expect(isBankAccountNumber(value)).toBe(false))
