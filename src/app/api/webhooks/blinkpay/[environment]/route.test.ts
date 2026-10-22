import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBlinkPayWebhookHandler } from './route'

const secret = 'whsec_test_secret'
const body = JSON.stringify({
  event_id: '11111111-1111-4111-8111-111111111111',
  event_type: 'urn:nz:co:blinkpay:debit:events:fixed-recurring-payment-completed',
  timestamp: '2026-08-15T12:00:00+12:00',
  frp_id: '22222222-2222-4222-8222-222222222222',
  consent_id: '33333333-3333-4333-8333-333333333333',
  payment_id: '44444444-4444-4444-8444-444444444444',
})
function request(overrides: { body?: string; contentType?: string; signature?: string } = {}) {
  const timestamp = Math.floor(new Date('2026-08-15T12:00:00Z').getTime() / 1000)
  const raw = overrides.body ?? body
  const signature = overrides.signature ?? `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex')}`
  return new Request('https://www.ev.church/api/webhooks/blinkpay/sandbox', { method: 'POST', headers: { 'content-type': overrides.contentType ?? 'application/json', 'x-signature': signature }, body: raw })
}

describe('BlinkPay webhook route', () => {
  beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => undefined) })
  afterEach(() => { vi.restoreAllMocks() })
  const contract = { contractVersion: 'blinkpay-debit-1.0.49', signatureHeader: 'x-signature', signatureFormat: 'timestamp-sha256-v1', eventFormat: 'fixed-recurring-payment-event-v1', secrets: [secret], acknowledgementStatus: 204 as const }

  it.each([0, 1])('logs only the accepted key position %i without credential or payment data', async (signingKeyIndex) => {
    const secrets = signingKeyIndex === 0 ? [secret, 'whsec_other_secret'] : ['whsec_other_secret', secret]
    const handler = createBlinkPayWebhookHandler({ now: () => new Date('2026-08-15T12:00:00Z'), contract: () => ({ ...contract, secrets }), record: vi.fn().mockResolvedValue({ outcome: 'duplicate', eventId: 7 }), queue: vi.fn() })
    expect((await handler(request(), { environment: 'production' })).status).toBe(204)
    expect(console.info).toHaveBeenCalledExactlyOnceWith({ category: 'blinkpay-webhook-accepted', environment: 'production', signingKeyIndex })
  })

  it('requests a provider retry when durable storage fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const queue = vi.fn()
      const handler = createBlinkPayWebhookHandler({ now: () => new Date('2026-08-15T12:00:00Z'), contract: () => contract, record: vi.fn().mockRejectedValue(new Error('database unavailable')), queue })
      expect((await handler(request(), {environment:'production'})).status).toBe(503)
      expect(queue).not.toHaveBeenCalled()
      expect(log).toHaveBeenCalledWith({category:'blinkpay-webhook-storage-failed',environment:'production'})
      expect(console.info).not.toHaveBeenCalled()
    } finally { log.mockRestore() }
  })

  it('durably inserts before best-effort queue and acknowledges a queue failure', async () => {
    const order: string[] = []
    const handler = createBlinkPayWebhookHandler({ now: () => new Date('2026-08-15T12:00:00Z'), contract: vi.fn().mockReturnValue(contract), record: vi.fn(async () => { order.push('record'); return { outcome: 'inserted' as const, eventId: 7 } }), queue: vi.fn(async () => { order.push('queue'); throw new Error('queue unavailable') }) })
    const response = await handler(request(), { environment: 'sandbox' })
    expect(response.status).toBe(204)
    expect(order).toEqual(['record', 'queue'])
  })

  it.each([
    ['unknown environment', 'other', request()],
    ['wrong content type', 'sandbox', request({ contentType: 'text/plain' })],
    ['bad signature', 'sandbox', request({ signature: 'bad' })],
    ['invalid signed payload', 'sandbox', request({ body: '{}' })],
  ])('fails closed for %s before persistence', async (_label, environment, input) => {
    const record = vi.fn()
    const handler = createBlinkPayWebhookHandler({ now: () => new Date('2026-08-15T12:00:00Z'), contract: vi.fn().mockReturnValue(contract), record, queue: vi.fn() })
    expect((await handler(input, { environment })).status).toBeGreaterThanOrEqual(400)
    expect(record).not.toHaveBeenCalled()
    expect(console.info).not.toHaveBeenCalled()
  })

  it('does not activate without a tenant-proven contract', async () => {
    const record = vi.fn()
    const handler = createBlinkPayWebhookHandler({ contract: vi.fn(() => { throw new Error('not configured') }), record, queue: vi.fn() })
    expect((await handler(request(), { environment: 'sandbox' })).status).toBe(503)
    expect(record).not.toHaveBeenCalled()
  })

  it('acknowledges after durably quarantining a reused event ID with different bytes', async () => {
    const handler = createBlinkPayWebhookHandler({ now: () => new Date('2026-08-15T12:00:00Z'), contract: vi.fn().mockReturnValue(contract), record: vi.fn().mockResolvedValue({ outcome: 'conflict', eventId: 7 }), queue: vi.fn() })
    expect((await handler(request(), { environment: 'sandbox' })).status).toBe(204)
  })

  it('acknowledges an unmatched production event only after durable quarantine', async () => {
    const record = vi.fn().mockResolvedValue({ outcome: 'quarantined', eventId: 8 })
    const queue = vi.fn()
    const handler = createBlinkPayWebhookHandler({ now: () => new Date('2026-08-15T12:00:00Z'), contract: vi.fn().mockReturnValue(contract), record, queue })
    expect((await handler(request(), { environment: 'production' })).status).toBe(204)
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      environment: 'production',
      referenceType: 'payment',
      referenceId: '44444444-4444-4444-8444-444444444444',
    }))
    expect(queue).not.toHaveBeenCalled()
  })
})
