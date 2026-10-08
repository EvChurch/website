import { describe, expect, it, vi } from 'vitest'

import { migrations } from '../migrations'
import {
  CONNECT_GROUP_MEMBER_COUNT_DOWN_SQL,
  CONNECT_GROUP_MEMBER_COUNT_UP_SQL,
  down,
  up,
} from '../migrations/20260910_020000_connect_group_member_count'

describe('Connect Group member count migration', () => {
  it('adds the member count column', () => {
    expect(CONNECT_GROUP_MEMBER_COUNT_UP_SQL).toContain('ADD COLUMN "member_count"')
  })

  it('registers after the existing migrations', () => {
    expect(
      migrations.findIndex(({ name }) => name === '20260910_020000_connect_group_member_count'),
    ).toBeGreaterThan(-1)
  })

  it('executes reversible SQL', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    await up({ db: { execute } } as never)
    await down({ db: { execute } } as never)

    expect(execute).toHaveBeenCalledTimes(2)
    expect(CONNECT_GROUP_MEMBER_COUNT_DOWN_SQL).toContain('DROP COLUMN "member_count"')
  })
})
