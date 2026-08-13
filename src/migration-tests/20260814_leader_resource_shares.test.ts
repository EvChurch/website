import { describe, expect, it, vi } from 'vitest'
import { LEADER_RESOURCE_SHARES_DOWN_SQL, LEADER_RESOURCE_SHARES_UP_SQL, down, up } from '../migrations/20260814_leader_resource_shares'

describe('leader resource share migration', () => {
  it('creates unique token and pair constraints', () => {
    expect(LEADER_RESOURCE_SHARES_UP_SQL).toContain('leader_resource_shares_token_unique')
    expect(LEADER_RESOURCE_SHARES_UP_SQL).toContain('leader_resource_shares_pair_key_unique')
    expect(LEADER_RESOURCE_SHARES_UP_SQL).toContain('leader_resource_shares_resource_sharer_unique')
    expect(LEADER_RESOURCE_SHARES_UP_SQL).toContain("SET LOCAL lock_timeout = '5s'")
  })

  it('protects issued links from destructive rollback', () => {
    expect(LEADER_RESOURCE_SHARES_DOWN_SQL).toContain('IF EXISTS (SELECT 1 FROM "leader_resource_shares")')
    expect(LEADER_RESOURCE_SHARES_DOWN_SQL.indexOf('RAISE EXCEPTION')).toBeLessThan(LEADER_RESOURCE_SHARES_DOWN_SQL.indexOf('DROP TABLE'))
  })

  it('runs each direction atomically', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    await up({ db: { execute } } as never)
    await down({ db: { execute } } as never)
    expect(execute).toHaveBeenCalledTimes(2)
  })
})
