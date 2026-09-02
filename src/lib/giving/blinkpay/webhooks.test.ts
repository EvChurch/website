import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { parseWebhookEvent, verifyBlinkPayWebhook } from './webhooks'

const now = new Date('2026-08-15T12:00:00Z')
const secret = 'whsec_current_secret'
const previous = 'whsec_previous_secret'
const body = Buffer.from(JSON.stringify({
  event_id: '11111111-1111-4111-8111-111111111111',
  event_type: 'urn:nz:co:blinkpay:debit:events:fixed-recurring-payment-completed',
  timestamp: '2026-08-15T12:00:00+12:00',
  frp_id: '22222222-2222-4222-8222-222222222222',
  consent_id: '33333333-3333-4333-8333-333333333333',
  payment_id: '44444444-4444-4444-8444-444444444444',
}))
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
    [signature('whsec_wrong_secret'), 'invalid'],
  ])('rejects %s signatures', (header, message) => {
    expect(() => verifyBlinkPayWebhook({ rawBody: body, signature: header, now, secrets: [secret], contractVersion: 'tenant-verified-v1', signatureFormat: 'timestamp-sha256-v1' })).toThrow(message)
  })

  it('parses only the configured fixed-recurring event envelope', () => {
    expect(parseWebhookEvent(body, 'fixed-recurring-payment-event-v1')).toEqual({
      eventId: '11111111-1111-4111-8111-111111111111',
      eventType: 'urn:nz:co:blinkpay:debit:events:fixed-recurring-payment-completed',
      referenceType: 'payment',
      referenceId: '44444444-4444-4444-8444-444444444444',
      payload: JSON.parse(body.toString()),
    })
    expect(() => parseWebhookEvent(body, '')).toThrow('Webhook event format is not configured')
    expect(() => parseWebhookEvent(Buffer.from('{'), 'fixed-recurring-payment-event-v1')).toThrow('Webhook body is not valid JSON')
    expect(() => parseWebhookEvent(Buffer.from(JSON.stringify({ ...JSON.parse(body.toString()), status: 'settled' })), 'fixed-recurring-payment-event-v1')).toThrow('Webhook event envelope is invalid')
  })

  it('uses the fixed recurring schedule reference when no payment id is present', () => {
    const cancelled = Buffer.from(JSON.stringify({
      event_id: '55555555-5555-4555-8555-555555555555',
      event_type: 'urn:nz:co:blinkpay:debit:events:fixed-recurring-payment-cancelled',
      timestamp: '2026-08-15T12:00:00+12:00',
      frp_id: '66666666-6666-4666-8666-666666666666',
      consent_id: '77777777-7777-4777-8777-777777777777',
    }))
    expect(parseWebhookEvent(cancelled, 'fixed-recurring-payment-event-v1')).toEqual(expect.objectContaining({
      referenceType: 'schedule',
      referenceId: '66666666-6666-4666-8666-666666666666',
    }))
  })
})
