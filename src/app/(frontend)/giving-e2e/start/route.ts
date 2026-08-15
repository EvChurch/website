import { NextRequest, NextResponse } from 'next/server'
import { hasExactPayloadAdminRole } from '@/access/roles'
import { createGivingE2ESessionService, createPayloadGivingE2ESessionStore, GIVING_E2E_COOKIE } from '@/lib/giving/e2e-session'
import { getPayloadClient } from '@/lib/payload'
import type { User } from '@/payload-types'
export const dynamic = 'force-dynamic'
const MAX_BODY_BYTES = 1_024
const HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow, noarchive' }
export interface StartE2EDependencies {
  admin(headers: Headers): Promise<number | null>
  start(input: { actorId: number; runId: string }): Promise<{ token: string; csrf: string; authority: { runId: string; synthetic: boolean; environment: string } }>
}
const json = (value: unknown, status: number) => NextResponse.json(value, { status, headers: HEADERS })
function trusted(request: NextRequest) {
  return request.headers.get('origin') === 'https://www.ev.church' &&
    request.headers.get('sec-fetch-site') === 'same-origin' &&
    request.headers.get('x-ev-giving-e2e-request') === 'start-v1' &&
    request.headers.get('content-type')?.split(';', 1)[0] === 'application/json'
}
async function boundedJson(request: NextRequest) {
  const declared = request.headers.get('content-length')
  if (declared && (!Number.isSafeInteger(Number(declared)) || Number(declared) < 0 || Number(declared) > MAX_BODY_BYTES)) throw new Error('invalid')
  if (!request.body) throw new Error('invalid')
  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined)
      throw new Error('invalid')
    }
    text += decoder.decode(value, { stream: true })
  }
  text += decoder.decode()
  return JSON.parse(text) as unknown
}
const defaults: StartE2EDependencies = {
  async admin(headers) {
    const payload = await getPayloadClient()
    const { user } = await payload.auth({ headers })
    return hasExactPayloadAdminRole(user as User | null) && user ? Number(user.id) : null
  },
  async start(input) {
    const payload = await getPayloadClient()
    return createGivingE2ESessionService(createPayloadGivingE2ESessionStore(payload)).start(input)
  },
}
export async function handleGivingE2EStart(request: NextRequest, deps: StartE2EDependencies = defaults) {
  try {
    if (!trusted(request)) return json({ error: 'Not found' }, 404)
    const actorId = await deps.admin(request.headers)
    if (!actorId) return json({ error: 'Not found' }, 404)
    const body = await boundedJson(request)
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 || typeof (body as { runId?: unknown }).runId !== 'string') return json({ error: 'Not found' }, 404)
    const result = await deps.start({ actorId, runId: (body as { runId: string }).runId })
    const response = json({ ok: true, runId: result.authority.runId, synthetic: true, csrf: result.csrf }, 201)
    response.cookies.set(GIVING_E2E_COOKIE, result.token, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 30 * 60 })
    return response
  } catch {
    return json({ error: 'Not found' }, 404)
  }
}
export async function POST(request: NextRequest) { return handleGivingE2EStart(request) }
