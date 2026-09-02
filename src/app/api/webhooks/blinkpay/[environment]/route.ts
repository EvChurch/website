import { getPayloadClient } from '@/lib/payload'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import type { GivingEnvironment } from '@/lib/giving/contracts'
import { createPostgresGivingLifecycleStore } from '@/lib/giving/reconciliation'
import { parseWebhookEvent, readBoundedRawBody, verifyBlinkPayWebhook, webhookPayloadDigest } from '@/lib/giving/blinkpay/webhooks'

export const dynamic = 'force-dynamic'
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' }

interface WebhookContract {
  contractVersion: string
  signatureHeader: string
  signatureFormat: string
  eventFormat: string
  secrets: readonly string[]
  acknowledgementStatus: 200 | 202 | 204
}

function loadContract(environment: GivingEnvironment, env: Record<string, string | undefined> = process.env): WebhookContract {
  const prefix = environment === 'sandbox' ? 'BLINKPAY_SANDBOX' : 'BLINKPAY_PRODUCTION'
  const contractVersion = env[`${prefix}_WEBHOOK_CONTRACT_VERSION`] ?? 'blinkpay-debit-1.0.49'
  const signatureHeader = env[`${prefix}_WEBHOOK_SIGNATURE_HEADER`] ?? 'x-signature'
  const signatureFormat = env[`${prefix}_WEBHOOK_SIGNATURE_FORMAT`] ?? 'timestamp-sha256-v1'
  const eventFormat = env[`${prefix}_WEBHOOK_EVENT_FORMAT`] ?? 'fixed-recurring-payment-event-v1'
  const acknowledgementStatus = Number(env[`${prefix}_WEBHOOK_ACK_STATUS`] ?? 204)
  const secrets = (env[`${prefix}_WEBHOOK_SECRETS`] ?? env[`${prefix}_WEBHOOK_SECRET`] ?? '').split(',').map((value) => value.trim()).filter(Boolean)
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u.test(contractVersion) || !/^[a-z0-9][a-z0-9-]{0,63}$/u.test(signatureHeader) || ![200,202,204].includes(acknowledgementStatus)) throw new Error('BlinkPay webhook contract is not configured')
  return { contractVersion, signatureHeader, signatureFormat, eventFormat, secrets, acknowledgementStatus: acknowledgementStatus as 200 | 202 | 204 }
}

interface Dependencies {
  now?: () => Date
  contract(environment: GivingEnvironment): WebhookContract
  record(input: { environment: GivingEnvironment; eventId: string; eventType: string; referenceType: 'payment' | 'schedule' | 'consent'; referenceId: string; payloadDigest: string; payload: Record<string, unknown>; now: Date }): Promise<{ outcome: 'inserted' | 'duplicate' | 'conflict' | 'quarantined'; eventId: number }>
  queue(eventId: number): Promise<void>
}

export function createBlinkPayWebhookHandler(dependencies: Dependencies) {
  return async (request: Request, params: { environment: string }): Promise<Response> => {
    if (params.environment !== 'sandbox' && params.environment !== 'production') return new Response(null, { status: 404, headers: PRIVATE_HEADERS })
    const environment = params.environment
    if (request.headers.get('content-type')?.split(';',1)[0]?.trim().toLowerCase() !== 'application/json') return new Response(null, { status: 415, headers: PRIVATE_HEADERS })
    let contract: WebhookContract
    try { contract = dependencies.contract(environment) } catch { return new Response(null, { status: 503, headers: PRIVATE_HEADERS }) }
    try {
      const rawBody = await readBoundedRawBody(request)
      verifyBlinkPayWebhook({ rawBody, signature: request.headers.get(contract.signatureHeader), now: (dependencies.now ?? (() => new Date()))(), secrets: contract.secrets, contractVersion: contract.contractVersion, signatureFormat: contract.signatureFormat })
      const event = parseWebhookEvent(rawBody, contract.eventFormat)
      const recorded = await dependencies.record({ environment, ...event, payloadDigest: webhookPayloadDigest(rawBody), now: (dependencies.now ?? (() => new Date()))() })
      if (recorded.outcome === 'inserted') await dependencies.queue(recorded.eventId).catch(() => undefined)
      return new Response(null, { status: contract.acknowledgementStatus, headers: PRIVATE_HEADERS })
    } catch { return new Response(null, { status: 400, headers: PRIVATE_HEADERS }) }
  }
}

async function defaults() {
  const payload = await getPayloadClient()
  const pool = requireGivingPostgresPool(payload)
  const store = createPostgresGivingLifecycleStore(pool)
  return createBlinkPayWebhookHandler({
    contract: (environment) => loadContract(environment),
    record: (input) => store.recordVerifiedEvent(input),
    queue: async (eventId) => { await payload.jobs.queue({ task: 'processBlinkPayWebhookEvent', input: { eventId }, queue: 'giving-lifecycle' }) },
  })
}

export async function POST(request: Request, context: { params: Promise<{ environment: string }> }) {
  try {
    const handler = await defaults()
    return handler(request, await context.params)
  } catch {
    return new Response(null, { status: 503, headers: PRIVATE_HEADERS })
  }
}
