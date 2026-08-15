import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { createBlinkPayWebhookHandler } from './route'

const secret = 'webhook-secret-at-least-thirty-two-bytes'
const body = JSON.stringify({ id: 'evt-1', type: 'payment.completed', data: { payment_id: 'pay-1' } })
function request(overrides: { body?: string; contentType?: string; signature?: string } = {}) {
  const timestamp = Math.floor(new Date('2026-08-15T12:00:00Z').getTime() / 1000)
  const raw = overrides.body ?? body
  const signature = overrides.signature ?? `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex')}`
  return new Request('https://www.ev.church/api/webhooks/blinkpay/sandbox', { method: 'POST', headers: { 'content-type': overrides.contentType ?? 'application/json', 'blinkpay-signature': signature }, body: raw })
}

describe('BlinkPay webhook route', () => {
  const contract = { contractVersion: 'tenant-verified-v1', signatureHeader: 'blinkpay-signature', signatureFormat: 'timestamp-sha256-v1', eventFormat: 'reference-event-v1', secrets: [secret], acknowledgementStatus: 204 as const }

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
  ])('fails closed for %s before persistence', async (_label, environment, input) => {
    const record = vi.fn()
    const handler = createBlinkPayWebhookHandler({ now: () => new Date('2026-08-15T12:00:00Z'), contract: vi.fn().mockReturnValue(contract), record, queue: vi.fn() })
    expect((await handler(input, { environment })).status).toBeGreaterThanOrEqual(400)
    expect(record).not.toHaveBeenCalled()
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
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ environment: 'production', referenceId: 'pay-1' }))
    expect(queue).not.toHaveBeenCalled()
  })
})
