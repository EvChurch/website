import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { parseWebhookEvent, verifyBlinkPayWebhook } from './webhooks'

const now = new Date('2026-08-15T12:00:00Z')
const secret = 'current-secret-at-least-thirty-two-bytes'
const previous = 'previous-secret-at-least-thirty-two-bytes'
const body = Buffer.from(JSON.stringify({ id: 'evt-1', type: 'payment.completed', data: { payment_id: 'pay-1' } }))
const signature = (key: string, timestamp = Math.floor(now.getTime() / 1000), raw = body) =>
  `t=${timestamp},v1=${createHmac('sha256', key).update(`${timestamp}.`).update(raw).digest('hex')}`

describe('BlinkPay webhook verifier', () => {
  it('accepts current and previous keys only with an explicit configured contract', () => {
    for (const key of [secret, previous]) {
      expect(verifyBlinkPayWebhook({ rawBody: body, signature: signature(key), now, secrets: [secret, previous], contractVersion: 'tenant-verified-v1', signatureFormat: 'timestamp-sha256-v1' })).toEqual({ timestamp: Math.floor(now.getTime() / 1000) })
    }
    expect(() => verifyBlinkPayWebhook({ rawBody: body, signature: signature(secret), now, secrets: [secret], contractVersion: '', signatureFormat: 'timestamp-sha256-v1' })).toThrow('Webhook contract is not configured')
  })

  it.each([
    ['', 'missing'],
    ['t=1', 'malformed'],
    [`t=${Math.floor(now.getTime() / 1000)},v1=${'0'.repeat(64)},extra=x`, 'malformed'],
    [signature(secret, Math.floor(now.getTime() / 1000) - 301), 'outside'],
    [signature(secret, Math.floor(now.getTime() / 1000) + 31), 'outside'],
    [signature('wrong-secret-at-least-thirty-two-bytes'), 'invalid'],
  ])('rejects %s signatures', (header, message) => {
    expect(() => verifyBlinkPayWebhook({ rawBody: body, signature: header, now, secrets: [secret], contractVersion: 'tenant-verified-v1', signatureFormat: 'timestamp-sha256-v1' })).toThrow(message)
  })

  it('parses only the configured conservative event envelope', () => {
    expect(parseWebhookEvent(body, 'reference-event-v1')).toEqual({ eventId: 'evt-1', eventType: 'payment.completed', referenceType: 'payment', referenceId: 'pay-1', payload: JSON.parse(body.toString()) })
    expect(() => parseWebhookEvent(body, '')).toThrow('Webhook event format is not configured')
    expect(() => parseWebhookEvent(Buffer.from('{'), 'reference-event-v1')).toThrow('Webhook body is not valid JSON')
    expect(() => parseWebhookEvent(Buffer.from(JSON.stringify({ ...JSON.parse(body.toString()), status: 'settled' })), 'reference-event-v1')).toThrow('Webhook event envelope is invalid')
  })
})
