import { describe, expect, it, vi } from 'vitest'

import {
  assertGivingContext,
  transitionConsentStatus,
  transitionPaymentStatus,
  transitionScheduleStatus,
} from './domain'
import { markProviderOperation, prepareProviderOperation } from './repository'

describe('giving domain invariants', () => {
  it('accepts only production real data or sandbox synthetic data', () => {
    expect(() => assertGivingContext('production', false, null)).not.toThrow()
    expect(() => assertGivingContext('sandbox', true, 42)).not.toThrow()
    expect(() => assertGivingContext('production', true, 42)).toThrow(/production/i)
    expect(() => assertGivingContext('sandbox', false, null)).toThrow(/sandbox/i)
  })

  it('allows monotonic payment transitions and rejects settled regressions', () => {
    expect(transitionPaymentStatus('pending', 'settled')).toBe('settled')
    expect(() => transitionPaymentStatus('settled', 'pending')).toThrow(/regress/i)
  })

  it('does not reopen terminal consents or cancelled schedules', () => {
    expect(() => transitionConsentStatus('revoked', 'authorised')).toThrow(/terminal/i)
    expect(() => transitionScheduleStatus('cancelled', 'active')).toThrow(/terminal/i)
  })

  it('rejects a mismatched load-or-prepare operation', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'prepared', provider_id: null, request_digest: 'other', correlation_key: 'corr', context_key: 'production' }] })
    await expect(prepareProviderOperation({ query } as never, {
      contextKey: 'production', environment: 'production', synthetic: false, e2eRunId: null,
      checkoutId: 1, provider: 'rock', action: 'rock.resolve-giver', logicalVersion: 1,
      requestDigest: 'digest', correlationKey: 'corr',
    })).rejects.toThrow(/does not match/)
  })

  it('binds a provider id only on a legal succeeded transition with one numbered attempt statement', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ id: 10 }] })
    const client = { query }
    await markProviderOperation(client as never, 1, 'succeeded', { providerId: 'payment-1', providerRequestId: 'request-1' })
    expect(query).toHaveBeenCalledOnce()
    expect(query.mock.calls[0][0]).toContain('attempt_number')
    expect(query.mock.calls[0][0]).toContain("provider_id=CASE WHEN $2='succeeded'")
    await expect(markProviderOperation(client as never, 1, 'unknown', { providerId: 'payment-1' })).rejects.toThrow(/only be bound on success/)
  })
})
