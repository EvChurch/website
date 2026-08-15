import { NextRequest, NextResponse } from 'next/server'

import { getAuth0Client } from '@/auth/auth0-client'
import { getMemberImpersonationFromSession } from '@/auth/member-impersonation'
import { getMemberProfileStateFromSession } from '@/auth/member-session'
import {
  respondToVolunteerSchedule,
  type VolunteerScheduleResponse,
} from '@/lib/members/volunteer-scheduling'

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  Vary: 'Cookie',
}
const SESSION_COOKIE_NAMES = ['__Host-ev_admin_session', 'ev_admin_session'] as const
const MAX_BODY_BYTES = 512
const ASSIGNMENT_ID_PATTERN = /^rock-schedule:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

function hasSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) =>
    SESSION_COOKIE_NAMES.some((sessionName) =>
      name === sessionName || name.startsWith(`${sessionName}__`),
    ),
  )
}

function json(body: unknown, status: number, extraHeaders?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { ...PRIVATE_HEADERS, ...extraHeaders },
  })
}

function parseInput(value: unknown): {
  assignmentId: string
  response: VolunteerScheduleResponse
  declineReasonId?: number
} | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (
    Object.keys(input).some((key) =>
      key !== 'assignmentId' && key !== 'response' && key !== 'declineReasonId') ||
    typeof input.assignmentId !== 'string' ||
    !ASSIGNMENT_ID_PATTERN.test(input.assignmentId) ||
    (input.response !== 'accept' && input.response !== 'decline') ||
    (input.response === 'accept' && input.declineReasonId !== undefined) ||
    (input.response === 'decline' && (
      typeof input.declineReasonId !== 'number' ||
      !Number.isSafeInteger(input.declineReasonId) ||
      input.declineReasonId <= 0
    ))
  ) return null
  return {
    assignmentId: input.assignmentId,
    response: input.response,
    ...(input.response === 'decline' ? { declineReasonId: input.declineReasonId as number } : {}),
  }
}

export async function POST(request: NextRequest) {
  if (
    request.headers.get('origin') !== request.nextUrl.origin ||
    !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')
  ) return json({ status: 'invalid-request' }, 400)
  if (!hasSessionCookie(request)) return json({ status: 'auth-required' }, 401)

  let personId: number
  try {
    const session = await getAuth0Client().getSession(request)
    if (!session?.user.sub) return json({ status: 'auth-required' }, 401)
    if (getMemberImpersonationFromSession(session)) {
      return json({ status: 'forbidden' }, 403)
    }
    const profileState = getMemberProfileStateFromSession(session)
    if (!profileState) return json({ status: 'auth-required' }, 401)
    personId = profileState.profile.personId
  } catch {
    return json({ status: 'auth-required' }, 401)
  }

  let input: ReturnType<typeof parseInput>
  try {
    const body = await request.text()
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return json({ status: 'invalid-request' }, 400)
    }
    input = parseInput(JSON.parse(body))
  } catch {
    return json({ status: 'invalid-request' }, 400)
  }
  if (!input) return json({ status: 'invalid-request' }, 400)

  const result = await respondToVolunteerSchedule(
    personId,
    input.assignmentId,
    input.response,
    new Date(),
    input.declineReasonId,
  )
  if (result.status === 'accepted' || result.status === 'declined') return json(result, 200)
  if (result.status === 'invalid-request') return json(result, 400)
  if (result.status === 'busy') return json(result, 429, { 'Retry-After': '1' })
  if (result.status === 'stale') return json(result, 409)
  return json(result, 503)
}
