import { NextRequest, NextResponse } from 'next/server'
import type { RockWebhookPayload } from '@/lib/rock-api'

const ROCK_WEBHOOK_SECRET = process.env.ROCK_WEBHOOK_SECRET || ''

function validateWebhook(request: NextRequest): boolean {
  // Validate via shared secret in header
  const secret = request.headers.get('x-rock-webhook-secret')
  if (!ROCK_WEBHOOK_SECRET) {
    console.warn('ROCK_WEBHOOK_SECRET not set, skipping validation')
    return true
  }
  return secret === ROCK_WEBHOOK_SECRET
}

export async function POST(request: NextRequest) {
  // Validate the webhook
  if (!validateWebhook(request)) {
    console.error('Webhook validation failed')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: RockWebhookPayload

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { entityType, entityId, operation } = body

  console.log(
    `[Rock Webhook] ${operation} ${entityType} #${entityId}`,
  )

  // TODO: In production, queue a targeted sync for this specific entity
  // rather than waiting for the next full reconciliation. Cache invalidation
  // happens only after synced Payload data has committed.

  return NextResponse.json({
    ok: true,
    entityType,
    entityId,
    operation,
    revalidated: null,
  })
}
