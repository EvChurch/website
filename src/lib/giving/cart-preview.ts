import { GIVE_SUNDAY_GIFTS, GIVE_SUNDAY_SUGGESTED_AMOUNTS_MINOR } from './campaign'
import type { CartProduct } from './cart'

export function campaignCartCatalog(sample: boolean): CartProduct[] {
  return GIVE_SUNDAY_GIFTS.map(gift => ({
    id: gift.id, title: gift.title,
    // Deliberately uniform test fixture, never campaign configuration or a recommended amount.
    fixedAmountMinor: sample ? 100 : gift.fixedAmountMinor,
    allowCustomAmount: true,
    suggestedAmountsMinor: gift.suggestedAmountsMinor ?? GIVE_SUNDAY_SUGGESTED_AMOUNTS_MINOR,
    allocation: { reference: gift.reference, glCode: gift.glCode, glName: gift.glName, project: gift.project },
  }))
}
