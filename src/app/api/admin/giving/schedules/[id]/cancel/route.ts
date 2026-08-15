import type { Pool } from 'pg'
import { NextRequest, NextResponse } from 'next/server'
import { hasExactPayloadAdminRole } from '@/access/roles'
import { createBlinkPayClient } from '@/lib/giving/blinkpay/client'
import { loadBlinkPayConfig } from '@/lib/giving/blinkpay/config'
import { createGivingCancellationService, createPostgresGivingCancellationStore } from '@/lib/giving/cancellation'
import { getPayloadClient } from '@/lib/payload'
import type { User } from '@/payload-types'

export const dynamic = 'force-dynamic'
const MAX_BODY_BYTES = 1_024
const HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow, noarchive' }

interface CancelDependencies {
  admin(headers: Headers): Promise<number | null>
  cancel(input: { actorId: number; scheduleId: number; phase: 'prepare' | 'confirm'; reason: unknown; nonce?: unknown }): Promise<{ nonce: string; expiresAt: string } | { status: 'cancelled' | 'unknown' | 'not-cancelled' }>
}

const response = (body: unknown, status: number) => NextResponse.json(body, { status, headers: HEADERS })
function trusted(request: NextRequest) {
  return request.headers.get('origin') === 'https://www.ev.church' &&
    request.headers.get('sec-fetch-site') === 'same-origin' &&
    request.headers.get('x-ev-giving-admin-request') === 'cancel-schedule-v1' &&
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
    if (size > MAX_BODY_BYTES) { await reader.cancel().catch(() => undefined); throw new Error('invalid') }
    text += decoder.decode(value, { stream: true })
  }
  text += decoder.decode()
  return JSON.parse(text) as unknown
}
async function defaults(): Promise<CancelDependencies> {
  const payload = await getPayloadClient()
  const pool = (payload.db as unknown as { pool?: Pool }).pool
  if (!pool) throw new Error('Giving cancellation requires PostgreSQL')
  const service = createGivingCancellationService({
    store: createPostgresGivingCancellationStore(pool),
    provider: (environment) => createBlinkPayClient({ config: loadBlinkPayConfig(environment) }),
  })
  return {
    async admin(headers) {
      const { user } = await payload.auth({ headers })
      return user && hasExactPayloadAdminRole(user as User) ? Number(user.id) : null
    },
    cancel(input) {
      return input.phase === 'prepare'
        ? service.prepare(input)
        : service.confirm({ ...input, nonce: input.nonce })
    },
  }
}

export async function handleGivingScheduleCancel(request: NextRequest, context: { params: Promise<{ id: string }> }, injected?: CancelDependencies) {
  try {
    if (!trusted(request)) return response({ error: 'Not found' }, 404)
    const deps = injected ?? await defaults()
    const actorId = await deps.admin(request.headers)
    if (!actorId) return response({ error: 'Not found' }, 404)
    const { id } = await context.params
    const scheduleId = Number(id)
    if (!Number.isSafeInteger(scheduleId) || scheduleId <= 0) return response({ error: 'Not found' }, 404)
    const value = await boundedJson(request)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return response({ error: 'Invalid request' }, 400)
    const body = value as Record<string, unknown>
    if (body.phase === 'prepare' && Object.keys(body).sort().join(',') === 'phase,reason') {
      const result = await deps.cancel({ actorId,scheduleId,phase:'prepare',reason:body.reason })
      return response(result, 201)
    }
    if (body.phase === 'confirm' && Object.keys(body).sort().join(',') === 'nonce,phase,reason') {
      const result = await deps.cancel({ actorId,scheduleId,phase:'confirm',reason:body.reason,nonce:body.nonce })
      if ('status' in result && result.status === 'cancelled') return response(result, 200)
      if ('status' in result && result.status === 'unknown') return response(result, 202)
      return response(result, 409)
    }
    return response({ error: 'Invalid request' }, 400)
  } catch {
    return response({ error: 'Unable to cancel schedule' }, 409)
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) { return handleGivingScheduleCancel(request, context) }
