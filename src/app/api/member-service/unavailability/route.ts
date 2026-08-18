import { NextRequest, NextResponse } from 'next/server'

import { getAuth0Client } from '@/auth/auth0-client'
import { getMemberImpersonationFromSession } from '@/auth/member-impersonation'
import { getMemberProfileStateFromSession } from '@/auth/member-session'
import {
  deleteVolunteerScheduleUnavailability,
  saveVolunteerScheduleUnavailability,
} from '@/lib/members/volunteer-scheduling'
import { isSameOriginRequest } from '@/lib/request-origin'

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  Vary: 'Cookie',
}
const SESSION_COOKIE_NAMES = ['__Host-ev_admin_session', 'ev_admin_session'] as const
const MAX_BODY_BYTES = 1_024

function json(body: unknown, status: number, extraHeaders?: Record<string, string>) {
  return NextResponse.json(body, {
    status,
    headers: { ...PRIVATE_HEADERS, ...extraHeaders },
  })
}

function hasSessionCookie(request: NextRequest) {
  return request.cookies.getAll().some(({ name }) =>
    SESSION_COOKIE_NAMES.some((sessionName) =>
      name === sessionName || name.startsWith(`${sessionName}__`),
    ),
  )
}

function parseInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (Object.keys(input).some((key) => !['startDate', 'endDate', 'groupId', 'notes'].includes(key))) {
    return null
  }
  return {
    startDate: input.startDate,
    endDate: input.endDate,
    groupId: input.groupId,
    notes: input.notes,
  }
}

export async function POST(request: NextRequest) {
  if (
    !isSameOriginRequest(request) ||
    !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')
  ) return json({ status: 'invalid-request' }, 400)
  if (!hasSessionCookie(request)) return json({ status: 'auth-required' }, 401)

  let personId: number
  try {
    const session = await getAuth0Client().getSession(request)
    if (!session?.user.sub) return json({ status: 'auth-required' }, 401)
    if (getMemberImpersonationFromSession(session)) return json({ status: 'forbidden' }, 403)
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

  const result = await saveVolunteerScheduleUnavailability(personId, input)
  if (result.status === 'saved') return json(result, 200)
  if (result.status === 'invalid-request') return json(result, 400)
  if (result.status === 'busy') return json(result, 429, { 'Retry-After': '1' })
  return json(result, 503)
}

export async function DELETE(request: NextRequest) {
  if (
    !isSameOriginRequest(request) ||
    !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')
  ) return json({ status: 'invalid-request' }, 400)
  if (!hasSessionCookie(request)) return json({ status: 'auth-required' }, 401)

  let personId: number
  try {
    const session = await getAuth0Client().getSession(request)
    if (!session?.user.sub) return json({ status: 'auth-required' }, 401)
    if (getMemberImpersonationFromSession(session)) return json({ status: 'forbidden' }, 403)
    const profileState = getMemberProfileStateFromSession(session)
    if (!profileState) return json({ status: 'auth-required' }, 401)
    personId = profileState.profile.personId
  } catch {
    return json({ status: 'auth-required' }, 401)
  }

  let id: unknown
  try {
    const body = await request.text()
    if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return json({ status: 'invalid-request' }, 400)
    }
    const input = JSON.parse(body) as unknown
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).length !== 1 ||
      !Object.hasOwn(input, 'id')
    ) return json({ status: 'invalid-request' }, 400)
    id = (input as Record<string, unknown>).id
  } catch {
    return json({ status: 'invalid-request' }, 400)
  }

  const result = await deleteVolunteerScheduleUnavailability(personId, id)
  if (result.status === 'deleted') return json(result, 200)
  if (result.status === 'invalid-request') return json(result, 400)
  if (result.status === 'busy') return json(result, 429, { 'Retry-After': '1' })
  return json(result, 503)
}
