import { describe, expect, it } from 'vitest'

import { sanitizeAnalyticsPayload } from './analytics'

describe('giving analytics privacy', () => {
  it('recursively removes financial, identity, provider, error, and capability fields', () => {
    expect(sanitizeAnalyticsPayload({
      step: 'frequency',
      outcome: 'continued',
      nested: {
        amount: 250,
        fundName: 'General',
        giver: { email: 'giver@example.com', personAliasId: 42 },
        providerPaymentId: 'payment-123',
        rawError: 'bank rejected the payment',
        capabilityToken: 'secret-capability',
      },
      rows: [{ frequency: 'monthly', accountName: 'Private' }],
    })).toEqual({
      step: 'frequency',
      outcome: 'continued',
      nested: { giver: {} },
      rows: [{ frequency: 'monthly' }],
    })
  })

  it('removes token-shaped values even under otherwise safe keys', () => {
    expect(sanitizeAnalyticsPayload({
      step: 'amount',
      detail: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature',
      opaque: '1fd66b0e-f3dd-40bb-aebf-f976d763ea37',
      safe: 'one-off',
    })).toEqual({ step: 'amount', safe: 'one-off' })
  })

  it('keeps an allowlisted feedback category without retaining an error', () => {
    expect(sanitizeAnalyticsPayload({
      step: 'result',
      outcome: 'failed',
      feedback_reason: 'testing',
      error: 'The payment was declined',
    })).toEqual({ step: 'result', outcome: 'failed', feedback_reason: 'testing' })
  })
})
