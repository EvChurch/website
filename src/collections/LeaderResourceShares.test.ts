import { describe, expect, it } from 'vitest'
import { LeaderResourceShares } from './LeaderResourceShares'

describe('LeaderResourceShares', () => {
  it('is hidden and denies every external operation', () => {
    expect(LeaderResourceShares.admin).toMatchObject({ hidden: true })
    for (const operation of ['read', 'create', 'update', 'delete'] as const) {
      expect(LeaderResourceShares.access?.[operation]?.({ req: { user: { roles: ['admin'] } } } as never)).toBe(false)
    }
  })

  it('uniquely indexes opaque tokens and leader-resource pairs', () => {
    expect(LeaderResourceShares.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'token', unique: true, index: true }),
      expect.objectContaining({ name: 'pairKey', unique: true, index: true }),
    ]))
  })
})
