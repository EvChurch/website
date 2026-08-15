import { NextRequest, NextResponse } from 'next/server'
import { hasExactPayloadAdminRole } from '@/access/roles'
import { createGivingE2ESessionService, createPayloadGivingE2ESessionStore, GIVING_E2E_COOKIE, GIVING_E2E_CSRF_HEADER } from '@/lib/giving/e2e-session'
import { getPayloadClient } from '@/lib/payload'
import type { User } from '@/payload-types'
export const dynamic = 'force-dynamic'
const HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow, noarchive' }
export interface StopE2EDependencies {
  admin(headers: Headers): Promise<number | null>
  stop(input: { token: string | undefined; csrf: string | undefined; actorId: number }): Promise<void>
}
const json = (value: unknown, status: number) => NextResponse.json(value, { status, headers: HEADERS })
function trusted(request: NextRequest) {
  return request.headers.get('origin') === 'https://www.ev.church' &&
    request.headers.get('sec-fetch-site') === 'same-origin' &&
    request.headers.get('x-ev-giving-e2e-request') === 'stop-v1'
}
const defaults: StopE2EDependencies = {
  async admin(headers) {
    const payload = await getPayloadClient()
    const { user } = await payload.auth({ headers })
    return hasExactPayloadAdminRole(user as User | null) && user ? Number(user.id) : null
  },
  async stop(input) {
    const payload = await getPayloadClient()
    return createGivingE2ESessionService(createPayloadGivingE2ESessionStore(payload)).stop(input)
  },
}
export async function handleGivingE2EStop(request: NextRequest, deps: StopE2EDependencies = defaults) {
  try {
    if (!trusted(request)) return json({ error: 'Not found' }, 404)
    const actorId = await deps.admin(request.headers)
    if (!actorId) return json({ error: 'Not found' }, 404)
    await deps.stop({ token: request.cookies.get(GIVING_E2E_COOKIE)?.value, csrf: request.headers.get(GIVING_E2E_CSRF_HEADER) ?? undefined, actorId })
    const response = json({ ok: true }, 200)
    response.cookies.delete(GIVING_E2E_COOKIE)
    return response
  } catch {
    return json({ error: 'Not found' }, 404)
  }
}
export async function POST(request: NextRequest) { return handleGivingE2EStop(request) }
