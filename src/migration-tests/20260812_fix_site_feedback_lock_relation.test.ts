import { describe, expect, it, vi } from 'vitest'

import {
  down,
  FIX_SITE_FEEDBACK_LOCK_RELATION_DOWN_SQL,
  FIX_SITE_FEEDBACK_LOCK_RELATION_UP_SQL,
  up,
} from '../migrations/20260812_190000_fix_site_feedback_lock_relation'
import { migrations } from '../migrations'

function migrationArgs(execute = vi.fn().mockResolvedValue(undefined)) {
  return {
    args: { db: { execute }, payload: {}, req: {} } as never,
    execute,
  }
}

describe('Site feedback lock relation corrective migration', () => {
  it('runs after the migration that creates feedback submissions', () => {
    const names = migrations.map(({ name }) => name)

    expect(names.indexOf('20260812_190000_fix_site_feedback_lock_relation')).toBeGreaterThan(
      names.indexOf('20260812_site_feedback'),
    )
  })

  it('adds the Payload lock relationship column, foreign key, and index', async () => {
    const { args, execute } = migrationArgs()

    await up(args)

    expect(execute).toHaveBeenCalledOnce()
    const query = FIX_SITE_FEEDBACK_LOCK_RELATION_UP_SQL
    expect(query).toContain('feedback_submissions_id')
    expect(query).toContain('payload_locked_documents_rels_feedback_submissions_fk')
    expect(query).toContain('payload_locked_documents_rels_feedback_submissions_id_idx')
    expect(query).toContain('REFERENCES "public"."feedback_submissions"("id")')
  })

  it('removes only the corrective lock relationship on rollback', async () => {
    const { args, execute } = migrationArgs()

    await down(args)

    expect(execute).toHaveBeenCalledOnce()
    const query = FIX_SITE_FEEDBACK_LOCK_RELATION_DOWN_SQL
    expect(query).toContain('DROP INDEX IF EXISTS')
    expect(query).toContain('DROP CONSTRAINT IF EXISTS')
    expect(query).toContain('DROP COLUMN IF EXISTS "feedback_submissions_id"')
    expect(query).not.toContain('DROP TABLE')
  })
})
