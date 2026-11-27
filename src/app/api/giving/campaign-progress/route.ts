import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import { readCampaignReceipts } from '@/lib/giving/campaign-receipts'
import { parseCampaignReceipts, type CampaignReceipts } from '@/lib/giving/campaign-progress'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
async function read() { return readCampaignReceipts(requireGivingPostgresPool(await getPayloadClient())) }

// Public aggregate numbers only; never return checkout, payment or donor records.
export async function handleCampaignProgressGet(load: () => Promise<CampaignReceipts> = read) {
  try { return NextResponse.json({ receipts: parseCampaignReceipts(await load()) }, { headers }) }
  catch { return NextResponse.json({ error: 'Campaign totals unavailable' }, { status: 503, headers }) }
}
export async function GET() { return handleCampaignProgressGet() }
