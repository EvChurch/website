export const BANK_ACCOUNT_PATTERN = '[0-9]{2}-[0-9]{4}-[0-9]{7}-[0-9]{2,3}'
export const BANK_ACCOUNT_FORMAT_MESSAGE = 'Enter a bank account number as 00-0000-0000000-00 or 00-0000-0000000-000.'
const bankAccountRegex = new RegExp(`^${BANK_ACCOUNT_PATTERN}$`)

export function isBankAccountNumber(value: string) {
  return bankAccountRegex.test(value)
}

export function formatBankAccountNumber(value: string) {
  const digits = value.replace(/\D/g, '')
  return [digits.slice(0, 2), digits.slice(2, 6), digits.slice(6, 13), digits.slice(13)].filter(Boolean).join('-')
}
