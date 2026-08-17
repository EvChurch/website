import { describe, expect, it } from 'vitest'

import { migrations } from '../migrations'
import {
  CONNECT_GROUP_COACHING_DOWN_SQL,
  CONNECT_GROUP_COACHING_UP_SQL,
} from '../migrations/20260817_085255_connect_group_coaching'

describe('Connect Group coaching migration', () => {
  it('adds the coached group mirror with its parent constraint and indexes', () => {
    expect(CONNECT_GROUP_COACHING_UP_SQL).toContain(
      'CREATE TABLE "connect_group_participants_coached_groups"',
    )
    expect(CONNECT_GROUP_COACHING_UP_SQL).toContain(
      'REFERENCES "public"."connect_group_participants"("id")',
    )
    expect(CONNECT_GROUP_COACHING_UP_SQL).toContain(
      'connect_group_participants_coached_groups_rock_group_id_idx',
    )
    expect(CONNECT_GROUP_COACHING_DOWN_SQL).toContain(
      'DROP TABLE IF EXISTS "connect_group_participants_coached_groups" CASCADE',
    )
    expect(migrations.some((migration) => migration.name === '20260817_085255_connect_group_coaching')).toBe(true)
  })
})
