import { describe, expect, it, vi } from 'vitest'

import { migrations } from '../migrations'
import {
  CONNECT_GROUPS_FINDER_DOWN_SQL,
  CONNECT_GROUPS_FINDER_UP_SQL,
  down,
  up,
} from '../migrations/20260825_120000_connect_groups_finder'

describe('Connect Groups finder migration', () => {
  it('adds the synced public fields and page block tables', () => {
    expect(CONNECT_GROUPS_FINDER_UP_SQL).toContain('ADD COLUMN "rock_group_guid"')
    expect(CONNECT_GROUPS_FINDER_UP_SQL).toContain('ADD COLUMN "schedule_text"')
    expect(CONNECT_GROUPS_FINDER_UP_SQL).toContain('ADD COLUMN "photo_id"')
    expect(CONNECT_GROUPS_FINDER_UP_SQL).toContain('CREATE TABLE "pages_blocks_connect_groups"')
    expect(CONNECT_GROUPS_FINDER_UP_SQL).not.toContain('INSERT INTO "pages_blocks_connect_groups"')
  })

  it('registers after the existing migrations', () => {
    expect(migrations.findIndex(({ name }) => name === '20260825_120000_connect_groups_finder')).toBeGreaterThan(-1)
  })

  it('executes reversible SQL', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)
    await up({ db: { execute } } as never)
    await down({ db: { execute } } as never)

    expect(execute).toHaveBeenCalledTimes(2)
    expect(CONNECT_GROUPS_FINDER_DOWN_SQL).toContain('DROP TABLE "pages_blocks_connect_groups"')
    expect(CONNECT_GROUPS_FINDER_DOWN_SQL).toContain('DROP COLUMN "rock_group_guid"')
    expect(CONNECT_GROUPS_FINDER_DOWN_SQL).toContain('DROP COLUMN "photo_id"')
  })
})
