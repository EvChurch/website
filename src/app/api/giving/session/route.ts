import { NextResponse } from 'next/server'

import { GIVING_PRIVATE_HEADERS } from '@/lib/giving/request-boundary'
import { givingSubmissionVersion } from '@/lib/giving/submission-version'

export const dynamic = 'force-dynamic'

export async function GET() {
  const version = givingSubmissionVersion()
  const available = process.env.GIVING_ACQUISITION_PAUSED !== 'true' && version !== null
  return NextResponse.json(available ? { version } : { error: 'Giving temporarily unavailable' }, {
    status: available ? 200 : 503,
    headers: GIVING_PRIVATE_HEADERS,
  })
}
