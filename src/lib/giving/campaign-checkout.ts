import { z } from 'zod'
import { GIVE_SUNDAY_GIFTS } from './campaign'

export const CAMPAIGN_CHECKOUT_NAME = 'Give Sunday gifts'
export const CAMPAIGN_CHECKOUT_FUND_CODE = 'GIVESUNDAY26'
const gift = z.object({ opportunityId: z.enum(['plant','train','grow','build','greatest-need']), amountMinor: z.number().int().safe().positive().multipleOf(100) }).strict()
export const campaignGiftsSchema = z.array(gift).min(1).max(5).superRefine((gifts, context) => {
  if (new Set(gifts.map(item => item.opportunityId)).size !== gifts.length || gifts.some(item => item.opportunityId === 'greatest-need') && gifts.length !== 1) context.addIssue({ code: 'custom', message: 'Choose allocated gifts or greatest need' })
  if (!Number.isSafeInteger(gifts.reduce((sum, item) => sum + item.amountMinor, 0))) context.addIssue({ code: 'custom', message: 'Invalid total' })
})
export type CampaignCheckoutGift = z.infer<typeof gift>
export function campaignGiftDefinition(id: CampaignCheckoutGift['opportunityId']) {
  return GIVE_SUNDAY_GIFTS.find(item => item.id === id)!
}
export function campaignGiftTotal(gifts: readonly CampaignCheckoutGift[]) { return gifts.reduce((sum,item) => sum + item.amountMinor,0) }
