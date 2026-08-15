import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const SIGNATURE = /^t=(0|[1-9]\d{0,10}),v1=([a-f0-9]{64})$/u
const EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u
const EVENT_TYPE = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/u
const REFERENCE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u

export const BLINKPAY_WEBHOOK_RELEASE_BLOCKER = 'BlinkPay tenant evidence must confirm the configured signature header, signing grammar, event envelope and acknowledgement semantics before activation.'

export interface VerifyBlinkPayWebhookInput {
  rawBody: Buffer
  signature: string | null
  now: Date
  secrets: readonly string[]
  contractVersion: string
  signatureFormat: string
  maximumAgeSeconds?: number
  maximumFutureSkewSeconds?: number
}

function fail(message: string): never { throw new Error(message) }

export function verifyBlinkPayWebhook(input: VerifyBlinkPayWebhookInput): { timestamp: number } {
  if (!input.contractVersion) fail('Webhook contract is not configured')
  if (input.signatureFormat !== 'timestamp-sha256-v1') fail('Webhook signature format is not configured')
  if (!input.signature) fail('Webhook signature is missing')
  if (input.secrets.length < 1 || input.secrets.length > 2 || input.secrets.some((secret) => Buffer.byteLength(secret) < 32)) fail('Webhook keyring is not configured')
  const match = SIGNATURE.exec(input.signature)
  if (!match) fail('Webhook signature is malformed')
  const timestamp = Number(match[1])
  const nowSeconds = Math.floor(input.now.getTime() / 1000)
  if (timestamp < nowSeconds - (input.maximumAgeSeconds ?? 300) || timestamp > nowSeconds + (input.maximumFutureSkewSeconds ?? 30)) fail('Webhook signature is outside the accepted time window')
  const received = Buffer.from(match[2], 'hex')
  let valid = false
  for (const secret of input.secrets) {
    const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(input.rawBody).digest()
    valid = (expected.length === received.length && timingSafeEqual(expected, received)) || valid
  }
  if (!valid) fail('Webhook signature is invalid')
  return { timestamp }
}

export type WebhookReferenceType = 'payment' | 'schedule' | 'consent'
export interface ParsedBlinkPayWebhookEvent {
  eventId: string
  eventType: string
  referenceType: WebhookReferenceType
  referenceId: string
  payload: Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

export function parseWebhookEvent(rawBody: Buffer, eventFormat: string): ParsedBlinkPayWebhookEvent {
  if (eventFormat !== 'reference-event-v1') fail('Webhook event format is not configured')
  let parsed: unknown
  try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody)) } catch { fail('Webhook body is not valid JSON') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('Webhook event envelope is invalid')
  const payload = parsed as Record<string, unknown>
  if (!exactKeys(payload, ['id', 'type', 'data']) || !EVENT_ID.test(String(payload.id)) || !EVENT_TYPE.test(String(payload.type)) || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) fail('Webhook event envelope is invalid')
  const data = payload.data as Record<string, unknown>
  const references = ([['payment', 'payment_id'], ['schedule', 'fixed_recurring_payment_id'], ['consent', 'consent_id']] as const)
    .filter(([, key]) => typeof data[key] === 'string' && REFERENCE_ID.test(String(data[key])))
  if (references.length !== 1 || !exactKeys(data, [references[0]![1]])) fail('Webhook event envelope is invalid')
  return { eventId: String(payload.id), eventType: String(payload.type), referenceType: references[0]![0], referenceId: String(data[references[0]![1]]), payload }
}

export function webhookPayloadDigest(rawBody: Buffer): string { return createHash('sha256').update(rawBody).digest('hex') }

export async function readBoundedRawBody(request: Request, maximumBytes = 64 * 1024): Promise<Buffer> {
  const declared = request.headers.get('content-length')
  if (declared && (!/^\d{1,10}$/u.test(declared) || Number(declared) > maximumBytes)) fail('Webhook body is too large')
  if (!request.body) return Buffer.alloc(0)
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maximumBytes) { await reader.cancel(); fail('Webhook body is too large') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total)
}
