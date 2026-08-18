import { describe, expect, it, vi } from 'vitest'

import { migrations } from '../migrations'
import {
  down,
  FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_DOWN_SQL,
  FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_UP_SQL,
  up,
} from '../migrations/20260819_030000_fix_connect_group_comments_lock_relation'

function migrationArgs(execute = vi.fn().mockResolvedValue(undefined)) {
  return {
    args: { db: { execute }, payload: {}, req: {} } as never,
    execute,
  }
}

describe('Connect Group comments lock relation corrective migration', () => {
  it('runs after both migrations that create the comments table', () => {
    const names = migrations.map(({ name }) => name)
    const correctiveIndex = names.indexOf(
      '20260819_030000_fix_connect_group_comments_lock_relation',
    )

    expect(correctiveIndex).toBeGreaterThan(
      names.indexOf('20260818_090000_connect_group_comments'),
    )
    expect(correctiveIndex).toBeGreaterThan(
      names.indexOf('20260819_010000_connect_group_comments'),
    )
  })

  it('adds the Payload lock relationship column, foreign key, and index idempotently', async () => {
    const { args, execute } = migrationArgs()

    await up(args)

    expect(execute).toHaveBeenCalledOnce()
    expect(FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_UP_SQL).toContain(
      'ADD COLUMN IF NOT EXISTS "connect_group_comments_id" integer',
    )
    expect(FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_UP_SQL).toContain(
      'payload_locked_documents_rels_connect_group_comments_fk',
    )
    expect(FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_UP_SQL).toContain(
      'REFERENCES "public"."connect_group_comments"("id")',
    )
    expect(FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_UP_SQL).toContain(
      'CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_connect_group_comments_id_idx"',
    )
    expect(FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_UP_SQL).toContain(
      'EXCEPTION WHEN duplicate_object THEN NULL',
    )
  })

  it('removes only the corrective lock relationship on rollback', async () => {
    const { args, execute } = migrationArgs()

    await down(args)

    expect(execute).toHaveBeenCalledOnce()
    expect(FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_DOWN_SQL).toContain(
      'DROP INDEX IF EXISTS',
    )
    expect(FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_DOWN_SQL).toContain(
      'DROP CONSTRAINT IF EXISTS',
    )
    expect(FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_DOWN_SQL).toContain(
      'DROP COLUMN IF EXISTS "connect_group_comments_id"',
    )
    expect(FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_DOWN_SQL).not.toContain(
      'DROP TABLE',
    )
  })
})
