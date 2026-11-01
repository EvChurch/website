export const DEFAULT_GIVING_TRANSACTION_FEE_MINOR = 50
export const MAX_GIVING_TRANSACTION_FEE_MINOR = 99_999_999

export interface CardFeeSettings { fixedMinor: number; percentageBasisPoints: number }

/** Recover the configured processing cost, including the percentage on the fee itself. */
export function cardTransactionFeeMinor(amountMinor: number, settings: CardFeeSettings): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 ||
      !Number.isSafeInteger(settings.fixedMinor) || settings.fixedMinor < 0 || settings.fixedMinor > 10_000 ||
      !Number.isSafeInteger(settings.percentageBasisPoints) || settings.percentageBasisPoints < 0 || settings.percentageBasisPoints > 2_000) {
    throw new Error('Invalid card fee')
  }
  const numerator = BigInt(amountMinor + settings.fixedMinor) * 10_000n
  const denominator = BigInt(10_000 - settings.percentageBasisPoints)
  const total = (numerator + denominator - 1n) / denominator
  const fee = Number(total - BigInt(amountMinor))
  if (!Number.isSafeInteger(fee) || fee > MAX_GIVING_TRANSACTION_FEE_MINOR || !Number.isSafeInteger(amountMinor + fee) || amountMinor + fee > 99_999_999) throw new Error('Gift exceeds the supported card amount')
  return fee
}
