import { NextRequest, NextResponse } from 'next/server'

import { getAuth0Client } from '@/auth/auth0-client'
import { getMemberProfileStateFromSession } from '@/auth/member-session'
import { UNAVAILABLE_MEMBER_NOTIFICATIONS } from '@/lib/member-notification-contract'
import { buildMemberNotifications } from '@/lib/member-notifications'
import { getVolunteerSchedule } from '@/lib/members/volunteer-scheduling'

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  Vary: 'Cookie',
}
const SESSION_COOKIE_NAMES = ['__Host-ev_admin_session', 'ev_admin_session'] as const
const MAX_CONCURRENT_PROVIDER_READS = 2
const PERSON_REQUEST_LIMIT = 4
const PERSON_THROTTLE_WINDOW_MS = 10_000
const THROTTLE_RETENTION_MS = 60_000
const PROVIDER_RETRY_AFTER_SECONDS = 5
let activeProviderReads = 0
const providerReadsByPerson = new Map<number, { count: number; windowStartedAt: number }>()

function hasSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) =>
    SESSION_COOKIE_NAMES.some((sessionName) =>
      name === sessionName || name.startsWith(`${sessionName}__`),
    ),
  )
}

function json(body: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { ...PRIVATE_HEADERS, ...extraHeaders },
  })
}

function pruneThrottleEntries(now: number) {
  for (const [personId, window] of providerReadsByPerson) {
    if (now - window.windowStartedAt >= THROTTLE_RETENTION_MS) providerReadsByPerson.delete(personId)
  }
}

function acquireProviderRead(personId: number):
  | { status: 'acquired' }
  | { status: 'throttled'; retryAfterSeconds: number }
  | { status: 'busy'; retryAfterSeconds: number } {
  const now = Date.now()
  pruneThrottleEntries(now)

  const window = providerReadsByPerson.get(personId)
  if (
    window &&
    now - window.windowStartedAt < PERSON_THROTTLE_WINDOW_MS &&
    window.count >= PERSON_REQUEST_LIMIT
  ) return {
    status: 'throttled',
    retryAfterSeconds: Math.max(1, Math.ceil(
      (PERSON_THROTTLE_WINDOW_MS - (now - window.windowStartedAt)) / 1000,
    )),
  }
  if (activeProviderReads >= MAX_CONCURRENT_PROVIDER_READS) {
    return { status: 'busy', retryAfterSeconds: 1 }
  }

  providerReadsByPerson.set(personId, window && now - window.windowStartedAt < PERSON_THROTTLE_WINDOW_MS
    ? { ...window, count: window.count + 1 }
    : { count: 1, windowStartedAt: now })
  activeProviderReads += 1
  return { status: 'acquired' }
}

function releaseProviderRead() {
  activeProviderReads = Math.max(0, activeProviderReads - 1)
}

export function __resetMemberNotificationLoadProtectionForTests() {
  if (process.env.NODE_ENV !== 'test') return
  activeProviderReads = 0
  providerReadsByPerson.clear()
}

export async function GET(request: NextRequest) {
  if (!hasSessionCookie(request)) return json({ status: 'auth-required' }, 401)

  let personId: number
  try {
    const session = await getAuth0Client().getSession(request)
    if (!session?.user.sub) return json({ status: 'auth-required' }, 401)
    const profileState = getMemberProfileStateFromSession(session)
    if (!profileState) return json({ status: 'auth-required' }, 401)
    personId = profileState.profile.personId
  } catch {
    return json({ status: 'auth-required' }, 401)
  }

  const admission = acquireProviderRead(personId)
  if (admission.status === 'throttled') {
    return json(UNAVAILABLE_MEMBER_NOTIFICATIONS, 429, {
      'Retry-After': String(admission.retryAfterSeconds),
    })
  }
  if (admission.status === 'busy') {
    return json(UNAVAILABLE_MEMBER_NOTIFICATIONS, 503, {
      'Retry-After': String(admission.retryAfterSeconds),
    })
  }

  try {
    const schedule = await getVolunteerSchedule(personId, new Date(), 'background')
    if (schedule.status === 'unavailable' && schedule.reason === 'rate-limited') {
      return json(UNAVAILABLE_MEMBER_NOTIFICATIONS, 429, {
        'Retry-After': String(schedule.retryAfterSeconds ?? 1),
      })
    }
    const notifications = buildMemberNotifications(schedule)
    return notifications.status === 'available'
      ? json(notifications)
      : json(notifications, 503, {
          'Retry-After': String(PROVIDER_RETRY_AFTER_SECONDS),
        })
  } catch {
    return json(UNAVAILABLE_MEMBER_NOTIFICATIONS, 503, {
      'Retry-After': String(PROVIDER_RETRY_AFTER_SECONDS),
    })
  } finally {
    releaseProviderRead()
  }
}
