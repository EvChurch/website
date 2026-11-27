// Campaign wording: Rowan, 31 October 2026. Accounting: Vincent, 3 November 2026.
// No fixed gift amounts were supplied in either email. Do not infer prices from GL codes.
export interface CampaignGift {
  id: string
  title: string
  description: string
  reference: string
  glCode: string
  glName: string
  project: string
  fixedAmountMinor: number | null
  suggestedAmountsMinor?: readonly number[]
}

export const CAMBODIA_SPONSORSHIP_URL = 'https://www.tearfund.org.nz/Child-Consignment/AKL-EV-Sponsorship-page'
export const GIVE_SUNDAY_SUGGESTED_AMOUNTS_MINOR = [20000, 100000, 500000] as const

export const GIVE_SUNDAY_GIFTS: readonly CampaignGift[] = [
  { id: 'plant', title: 'Plant — the next church beyond Auckland', description: 'Help take the good news of Jesus beyond Auckland by giving towards the next church plant.', reference: 'GIVE26PLANT', glCode: '413', glName: 'Planting for NZ Donations', project: 'T-Give26 Plant', fixedAmountMinor: null },
  { id: 'train', title: 'Train — Two more pastors to grow us', description: 'Help train two more pastors to serve and grow our church family.', reference: 'GIVE26TRAIN', glCode: '406', glName: 'One Off Giving Donations', project: 'T-Give26 Train', fixedAmountMinor: null },
  { id: 'grow', title: "Grow — Make room for Central's Kids", description: 'Help make room for the children at Central — space to learn about Jesus, build friendships, and grow in faith.', reference: 'GIVE26GROW', glCode: '406', glName: 'One Off Giving Donations', project: 'T-Give26 Grow', fixedAmountMinor: null },
  { id: 'build', title: 'Build — Pay off our North Fit Out', description: 'Help pay off the fit out of our North campus.', reference: 'GIVE26BUILD', glCode: '411', glName: 'Investment Fund Donations', project: 'T-Give26 Build', fixedAmountMinor: null },
  { id: 'greatest-need', title: "God's money, greatest need", description: 'Give one amount and let Ev put it towards the areas of greatest need.', reference: 'GIVE26GEN', glCode: '406', glName: 'One Off Giving Donations', project: 'T-Give26 General', fixedAmountMinor: null },
]
