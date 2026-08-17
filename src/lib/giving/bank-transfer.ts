export const GIVING_BANK_ACCOUNT = {
  accountName: 'Auckland Evangelical Church Trust',
  accountNumber: '01-1845-0008260-05',
} as const

export interface GivingBankTransferDetails {
  accountName: string
  accountNumber: string
  particulars: string
  code: string
  reference: string
}

export interface GivingBankTransferPreparation extends GivingBankTransferDetails {
  acknowledgementToken: string
}

export function givingBankCode(firstName: string, lastName: string) {
  const initial = firstName.normalize('NFKD').replace(/\p{Mark}/gu, '').trim().charAt(0)
  const surname = lastName.normalize('NFKD').replace(/\p{Mark}/gu, '')
  const code = `${initial}${surname}`.toUpperCase().replace(/[^A-Z0-9]/gu, '').slice(0, 12)
  return code || 'GIVER'
}

export function givingBankTransferDetails(fundCode: string, bankCode: string, bankReference: string): GivingBankTransferDetails {
  return {
    ...GIVING_BANK_ACCOUNT,
    particulars: fundCode.slice(0, 12),
    code: bankCode,
    reference: bankReference,
  }
}
