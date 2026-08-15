import { describe, expect, it, vi } from 'vitest'

import type { BlinkPayConfig } from './types'
import { createBlinkPayRuntimeClientRegistry } from './runtime-client'

const config = (environment: 'sandbox' | 'production') => ({ environment }) as BlinkPayConfig

describe('BlinkPay runtime client registry', () => {
  it('reuses one client per exact environment without cross-environment leakage', () => {
    const loadConfig = vi.fn(config)
    const createClient = vi.fn(({ config: loaded }: { config: BlinkPayConfig }) => ({ environment: loaded.environment }))
    const getClient = createBlinkPayRuntimeClientRegistry({ loadConfig, createClient: createClient as never })
    const sandbox = getClient('sandbox')
    expect(getClient('sandbox')).toBe(sandbox)
    const production = getClient('production')
    expect(production).not.toBe(sandbox)
    expect(getClient('production')).toBe(production)
    expect(loadConfig.mock.calls).toEqual([['sandbox'], ['production']])
    expect(createClient).toHaveBeenCalledTimes(2)
  })

  it('does not cache failed construction or a mismatched configuration', () => {
    const mismatched = createBlinkPayRuntimeClientRegistry({ loadConfig:vi.fn(() => config('production')), createClient:vi.fn() as never })
    expect(() => mismatched('sandbox')).toThrow(/mismatch/u)
    const createClient = vi.fn().mockImplementationOnce(() => { throw new Error('failed') }).mockReturnValue({ environment: 'sandbox' })
    const retrying = createBlinkPayRuntimeClientRegistry({ loadConfig: vi.fn(() => config('sandbox')), createClient: createClient as never })
    expect(() => retrying('sandbox')).toThrow('failed')
    expect(retrying('sandbox')).toEqual({ environment: 'sandbox' })
    expect(createClient).toHaveBeenCalledTimes(2)
  })
})
