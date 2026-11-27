export type CampaignProgressKey = 'cambodia' | 'plant' | 'train' | 'grow' | 'build' | 'greatest-need'

export interface CampaignProgressValues {
  unit: 'money' | 'children'
  // Money is stored in minor units; sponsorships are whole children.
  goal: number | null
  given: number | null
}

// Only confirmed campaign figures belong here. Never populate this from synthetic checkout data.
// Rowan's brief describes 50 children; sponsorship goals aren't displayed because
// the site has no real-time Tearfund data.
// Build and Grow.probundle (22 November 2026), slides 6, 9 and 10 and their speaker
// notes confirm this year's Build and Grow goals. The three-year partner pledge
// is not a current campaign receipt. Tatai confirmed the updated fund goals
// on 26 November 2026. Confirmed receipts are loaded separately from the giving ledger.
export const CAMPAIGN_FUND_GOALS = {
  plant: 5_000_000,
  train: 10_000_000,
  grow: 5_000_000,
  build: 27_500_000,
} as const
type Fund = keyof typeof CAMPAIGN_FUND_GOALS
const funds = Object.keys(CAMPAIGN_FUND_GOALS) as Fund[]
export type CampaignReceipts = Record<Fund | 'greatest-need', number | null>

// Each fund reports its own receipts. Greatest Need remains GIVE26GEN and is
// neither redistributed nor used as the combined total of the other funds.
export function campaignProgressFromReceipts(receipts: CampaignReceipts, childrenSponsored: number | null = null): Readonly<Record<CampaignProgressKey, CampaignProgressValues>> {
  const progress = Object.fromEntries(funds.map(id => {
    return [id, { unit: 'money' as const, goal: CAMPAIGN_FUND_GOALS[id], given: valid(receipts[id], 0) }]
  })) as Record<Fund, CampaignProgressValues>
  return {
    ...progress,
    cambodia: { unit: 'children', goal: null, given: valid(childrenSponsored, 0) },
    'greatest-need': { unit: 'money', goal: null, given: valid(receipts['greatest-need'], 0) },
  }
}

export const CAMPAIGN_PROGRESS = campaignProgressFromReceipts({
  plant: null, train: null, grow: null, build: null, 'greatest-need': null,
})

function valid(value: number | null, minimum: number): number | null {
  return value !== null && Number.isSafeInteger(value) && value >= minimum ? value : null
}

export function campaignProgress(values: CampaignProgressValues) {
  const goal = valid(values.goal, 1)
  const given = valid(values.given, 0)
  return { goal, given, percent: goal !== null && given !== null ? Math.min(100, given / goal * 100) : null }
}

export function formatCampaignProgress(value: number | null, unit: CampaignProgressValues['unit']) {
  if (value === null) return unit === 'money' ? '$0' : '—'
  return unit === 'children'
    ? new Intl.NumberFormat('en-NZ').format(value)
    : new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value / 100)
}


export function parseCampaignReceipts(value: unknown): CampaignReceipts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid campaign totals')
  const record = value as Record<string, unknown>
  const keys = [...funds, 'greatest-need'] as const
  if (Object.keys(record).length !== keys.length || keys.some(key => !Number.isSafeInteger(record[key]) || Number(record[key]) < 0)) throw new Error('Invalid campaign totals')
  return Object.fromEntries(keys.map(key => [key, record[key]])) as CampaignReceipts
}
