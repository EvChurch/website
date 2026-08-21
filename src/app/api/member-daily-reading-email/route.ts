import { NextRequest, NextResponse } from 'next/server'

import { getAuth0Client } from '@/auth/auth0-client'
import { getMemberProfileStateFromSession } from '@/auth/member-session'
import { subscribeDailyReadingEmail } from '@/lib/daily-readings/email-subscription'
import { isSameOriginRequest } from '@/lib/request-origin'

export const dynamic = 'force-dynamic'

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return response({ error: 'Invalid request origin' }, 403)
  }

  try {
    const session = await getAuth0Client().getSession(request)
    const profile = getMemberProfileStateFromSession(session)?.profile
    if (!profile) return response({ error: 'Sign in to continue' }, 401)

    const result = await subscribeDailyReadingEmail(profile.personId)
    return response({ subscribed: true, ...result })
  } catch {
    console.error({ category: 'daily-reading-email-signup-failed' })
    return response({ error: 'Unable to sign you up right now' }, 502)
  }
}
