import { createHmac } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import { getAuth0Client } from '@/auth/auth0-client'
import { getMemberImpersonationFromSession } from '@/auth/member-impersonation'
import { getMemberProfileStateFromSession } from '@/auth/member-session'
import { isCurrentPayloadAdmin } from '@/auth/payload-admin-session'
import { givingCapabilityCookieNames } from '@/lib/giving/drafts'
import { ANONYMOUS_MEMBER_CHROME, type MemberChromeState } from '@/lib/member-chrome'
import { getTurnstileSiteKey } from '@/lib/rock-forms/config'

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  Vary: 'Cookie',
}

const SESSION_COOKIE_NAMES = ['__Host-ev_admin_session', 'ev_admin_session'] as const

function hasSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) =>
    SESSION_COOKIE_NAMES.some((sessionName) =>
      name === sessionName || name.startsWith(`${sessionName}__`),
    ),
  )
}

function givingResumeRequested(request: NextRequest) {
  const secure = request.nextUrl.protocol === 'https:'
  return Boolean(
    request.cookies.get(givingCapabilityCookieNames(secure).resume)?.value ||
    request.cookies.get('__Host-ev_giving_checkout')?.value,
  )
}

async function anonymousResponse(request: NextRequest) {
  return NextResponse.json({
    ...ANONYMOUS_MEMBER_CHROME,
    givingResumeRequested: givingResumeRequested(request),
    givingTurnstileSiteKey: turnstileSiteKey(),
  }, { headers: PRIVATE_HEADERS })
}

function turnstileSiteKey() {
  try {
    return getTurnstileSiteKey()
  } catch {
    return null
  }
}

export function postHogMemberIdentity(subject: string, profile: { name: string; email: string }) {
  const secret = process.env.POSTHOG_IDENTITY_SECRET
  if (!secret || secret.length < 32) return null
  return {
    distinctId: createHmac('sha256', secret).update(`ev-member\0${subject}`).digest('base64url'),
    name: profile.name,
    email: profile.email,
  }
}

export async function GET(request: NextRequest) {
  if (!hasSessionCookie(request)) return anonymousResponse(request)

  try {
    const session = await getAuth0Client().getSession(request)
    if (!session?.user.sub) return anonymousResponse(request)

    const profileState = getMemberProfileStateFromSession(session)
    const impersonation = getMemberImpersonationFromSession(session)
    const payloadAdmin = await isCurrentPayloadAdmin(request.headers)

    const state = {
      memberProfile: profileState
        ? {
            name: profileState.profile.name,
            email: profileState.profile.email,
            avatarUrl:
              profileState.profile.photoUrl || profileState.needsRefresh
                ? '/member-avatar'
                : null,
          }
        : null,
      memberCampusSlug: profileState?.profile.campusSlug ?? null,
      adminHref: payloadAdmin ? '/admin/impersonate' : null,
      impersonation,
      givingResumeRequested: givingResumeRequested(request),
      givingTurnstileSiteKey: turnstileSiteKey(),
      postHogIdentity: profileState
        ? postHogMemberIdentity(session.user.sub, profileState.profile)
        : null,
    } satisfies MemberChromeState

    return NextResponse.json(state, { headers: PRIVATE_HEADERS })
  } catch {
    return anonymousResponse(request)
  }
}
