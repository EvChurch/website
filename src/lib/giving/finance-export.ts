import type { Pool } from 'pg'

export function csvCell(value:unknown):string {
  let text=value instanceof Date?value.toISOString():value==null?'':String(value)
  // Spreadsheet applications must not execute donor-controlled cells as formulas.
  if (/^[\s]*[=+@-]/u.test(text)) text=`'${text}`
  return `"${text.replaceAll('"','""')}"`
}

export async function givingFinanceCsv(pool:Pool,from:string,to:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/u.test(from)||!/^\d{4}-\d{2}-\d{2}$/u.test(to))throw new Error('Invalid date range')
  const start=Date.parse(`${from}T00:00:00Z`),end=Date.parse(`${to}T00:00:00Z`)
  if(!Number.isFinite(start)||!Number.isFinite(end)||new Date(start).toISOString().slice(0,10)!==from||new Date(end).toISOString().slice(0,10)!==to||end<start||end-start>366*86400_000)throw new Error('Choose a date range of at most one year')
  const result=await pool.query(`SELECT gift.id,checkout.correlation_key checkout_reference,gift.payment_provider,gift.status payment_status,
    gift.provider_observed_at payment_confirmed_at,giver.rock_person_alias_id,giver.name donor_name,giver.email donor_email,
    gift.fund_code,gift.fund_name,gift.fund_accounting_key,gift.amount_minor gift_cents,gift.transaction_fee_minor donor_fee_cents,
    gift.amount_minor+gift.transaction_fee_minor charged_cents,gift.processing_fee_minor processor_fee_cents,gift.net_minor processor_net_cents,
    gift.provider_payment_id,gift.provider_charge_id,gift.provider_invoice_id,gift.payout_id,gift.dispute_status,
    COALESCE(gift.payout_status,'not recorded') payout_status
    FROM giving_gifts gift JOIN giving_checkouts checkout ON checkout.id=gift.checkout_id AND checkout.context_key=gift.context_key
    JOIN giving_givers giver ON giver.id=gift.giver_id AND giver.context_key=gift.context_key
    WHERE gift.environment='production' AND gift.synthetic=false AND gift.context_key='production'
      AND COALESCE(gift.provider_observed_at,gift.created_at)>=($1::date::timestamp AT TIME ZONE 'Pacific/Auckland')
      AND COALESCE(gift.provider_observed_at,gift.created_at)<(($2::date+1)::timestamp AT TIME ZONE 'Pacific/Auckland')
    ORDER BY gift.id LIMIT 25001`,[from,to])
  if(result.rows.length>25000)throw new Error('Choose a shorter date range')
  const columns=['id','checkout_reference','payment_provider','payment_status','payment_confirmed_at','rock_person_alias_id','donor_name','donor_email','fund_code','fund_name','fund_accounting_key','gift_cents','donor_fee_cents','charged_cents','processor_fee_cents','processor_net_cents','provider_payment_id','provider_charge_id','provider_invoice_id','payout_id','payout_status','dispute_status']
  return '\uFEFF'+[columns.map(csvCell).join(','),...result.rows.map((row:Record<string,unknown>)=>columns.map(column=>csvCell(row[column])).join(','))].join('\r\n')+'\r\n'
}
