import type { Pool } from 'pg'
import { CAMPAIGN_CHECKOUT_FUND_CODE } from './campaign-checkout'
import { parseCampaignReceipts, type CampaignReceipts } from './campaign-progress'

/** Cumulative confirmed allocations, matching the allocation finance export; fees/refunds are separate. */
export async function readCampaignReceipts(pool: Pick<Pool, 'query'>): Promise<CampaignReceipts> {
  const result = await pool.query<{ opportunity_id: string; amount_minor: string }>(`
    SELECT allocation.opportunity_id,SUM(allocation.amount_minor)::text amount_minor
    FROM giving_checkout_allocations allocation
    JOIN giving_checkouts checkout ON checkout.id=allocation.checkout_id
    WHERE checkout.context_key='production' AND checkout.environment='production' AND checkout.synthetic=false
      AND checkout.status='completed' AND checkout.result_code='verified' AND checkout.frequency='one-off'
      AND checkout.fund_code=$1
      AND EXISTS (
        SELECT 1 FROM giving_gifts gift
        WHERE gift.checkout_id=checkout.id AND gift.context_key=checkout.context_key
          AND gift.environment='production' AND gift.synthetic=false AND gift.status='settled'
          AND gift.amount_minor=checkout.amount_minor
      )
    GROUP BY allocation.opportunity_id`, [CAMPAIGN_CHECKOUT_FUND_CODE])
  const receipts = { plant: 0, train: 0, grow: 0, build: 0, 'greatest-need': 0 }
  for (const row of result.rows) {
    if (!Object.hasOwn(receipts, row.opportunity_id)) throw new Error('Unknown campaign allocation')
    receipts[row.opportunity_id as keyof typeof receipts] = Number(row.amount_minor)
  }
  return parseCampaignReceipts(receipts)
}
