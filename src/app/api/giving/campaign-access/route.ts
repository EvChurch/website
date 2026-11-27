import { NextRequest, NextResponse } from 'next/server'
import { campaignGivingEnabled } from '@/lib/giving/campaign-enabled'
import { getCampaignGivingAccess } from '@/lib/giving/campaign-access-server'
import { GIVING_PRIVATE_HEADERS } from '@/lib/giving/request-boundary'

export async function GET(request: NextRequest) {
  if (!campaignGivingEnabled()) return new NextResponse(null, { status: 404 })
  return NextResponse.json(await getCampaignGivingAccess(request), {
    headers: { ...GIVING_PRIVATE_HEADERS, Vary: 'Cookie' },
  })
}
