import { describe, expect, it, vi } from 'vitest'

import {
  FIX_LEADER_RESOURCE_SHARE_LOCK_RELATION_DOWN_SQL,
  FIX_LEADER_RESOURCE_SHARE_LOCK_RELATION_UP_SQL,
  down,
  up,
} from '../migrations/20260814_143000_fix_leader_resource_share_lock_relation'

describe('leader resource share lock relation repair migration', () => {
  it('adds the missing Payload lock relationship idempotently', () => {
    expect(FIX_LEADER_RESOURCE_SHARE_LOCK_RELATION_UP_SQL).toContain('ADD COLUMN IF NOT EXISTS "leader_resource_shares_id"')
    expect(FIX_LEADER_RESOURCE_SHARE_LOCK_RELATION_UP_SQL).toContain('payload_locked_documents_rels_leader_resource_shares_fk')
    expect(FIX_LEADER_RESOURCE_SHARE_LOCK_RELATION_UP_SQL).toContain('CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_leader_resource_shares_id_idx"')
  })

  it('removes the lock relationship on rollback', () => {
    expect(FIX_LEADER_RESOURCE_SHARE_LOCK_RELATION_DOWN_SQL).toContain('DROP COLUMN IF EXISTS "leader_resource_shares_id"')
  })

  it('executes both directions through Payload migrations', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    await up({ db: { execute } } as never)
    await down({ db: { execute } } as never)
    expect(execute).toHaveBeenCalledTimes(2)
  })
})
