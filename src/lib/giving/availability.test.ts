import { describe, expect, it } from 'vitest'

import { resolveGivingServerEligibility } from './availability'

describe('giving server eligibility', () => {
  it('enables production only for the exact true environment value', () => {
    expect(resolveGivingServerEligibility({ productionEnabled: 'true' })).toBe('production')
    expect(resolveGivingServerEligibility({ productionEnabled: 'TRUE' })).toBeNull()
    expect(resolveGivingServerEligibility({ productionEnabled: '1' })).toBeNull()
    expect(resolveGivingServerEligibility({ productionEnabled: undefined })).toBeNull()
  })

  it('accepts only a server-verified protected E2E result', () => {
    expect(resolveGivingServerEligibility({
      productionEnabled: undefined,
      protectedE2E: true,
    })).toBe('protected-e2e')
  })
})
