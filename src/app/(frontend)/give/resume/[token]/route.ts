import { NextRequest, NextResponse } from 'next/server'

import { getAuth0Client } from '@/auth/auth0-client'
import {
  createGivingDraftService,
  createPayloadGivingDraftStore,
  givingCapabilityCookieNames,
  givingResumeRedirectUrl,
  type GivingDraftBinding,
} from '@/lib/giving/drafts'
import { getPayloadClient } from '@/lib/payload'
import { GIVING_PRIVATE_HEADERS } from '@/lib/giving/request-boundary'

export const dynamic = 'force-dynamic'

async function subject() {
  try {
    const session = await getAuth0Client().getSession()
    return typeof session?.user?.sub === 'string' && session.user.sub ? session.user.sub : null
  } catch { return null }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const secure = process.env.NODE_ENV === 'production' || request.nextUrl.protocol === 'https:'
  const names = givingCapabilityCookieNames(secure)
  try {
    const { token } = await params
    const memberSubject = await subject()
    const nonce = request.cookies.get(names.guest)?.value
    const candidates: GivingDraftBinding[] = [
      ...(memberSubject ? [{ audience: 'member' as const, subject: memberSubject }] : []),
      ...(nonce ? [{ audience: 'guest' as const, nonce }] : []),
    ]
    const service = createGivingDraftService(createPayloadGivingDraftStore(await getPayloadClient()))
    let answers = null
    for (const binding of candidates) {
      try {
        answers = await service.redeem({ token, binding })
        break
      } catch { /* uniform fallback across possible server bindings */ }
    }
    if (!answers) throw new Error('unavailable')
    const cleanUrl = givingResumeRedirectUrl(request.url, answers.returnPathname)
    const sessionBinding: GivingDraftBinding = memberSubject
      ? { audience: 'member', subject: memberSubject }
      : { audience: 'guest', nonce: nonce! }
    const resume = await service.createSession({ answers, binding: sessionBinding })
    const result = NextResponse.redirect(cleanUrl, { headers: GIVING_PRIVATE_HEADERS })
    result.cookies.set(names.resume, resume.token, {
      httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 15 * 60,
    })
    return result
  } catch {
    const result = NextResponse.redirect(new URL('/', request.url), { headers: GIVING_PRIVATE_HEADERS })
    result.cookies.delete(names.resume)
    return result
  }
}
