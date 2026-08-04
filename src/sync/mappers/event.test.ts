import { describe, expect, it } from 'vitest'

import { normalizeRockDateTime } from './event'

describe('normalizeRockDateTime', () => {
  it('interprets Rock timestamps as Auckland local time', () => {
    expect(normalizeRockDateTime('2026-08-09T10:15:00')).toBe('2026-08-08T22:15:00.000Z')
    expect(normalizeRockDateTime('2026-01-11T10:15:00')).toBe('2026-01-10T21:15:00.000Z')
  })

  it('preserves timestamps that already include an offset', () => {
    expect(normalizeRockDateTime('2026-08-08T22:15:00Z')).toBe('2026-08-08T22:15:00.000Z')
  })
})
