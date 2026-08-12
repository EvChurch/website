import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import { down, up } from '@/migrations/20260812_zzz_missing_paths'
import { migrations } from '@/migrations'

function migrationArgs(execute = vi.fn().mockResolvedValue(undefined)) {
  return {
    args: { db: { execute }, payload: {}, req: {} } as never,
    execute,
  }
}

describe('missing paths migration', () => {
  it('runs after the merged main migrations', () => {
    const names = migrations.map(({ name }) => name)

    expect(names.indexOf('20260812_zzz_missing_paths')).toBeGreaterThan(
      names.indexOf('20260812_190000_fix_site_feedback_lock_relation'),
    )
  })

  it('ships a current-schema snapshot containing only the MissingPaths delta', () => {
    const before = JSON.parse(
      readFileSync(
        new URL(
          '../migrations/20260812_zz_current_schema_checkpoint.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as { tables: Record<string, unknown> }
    const after = JSON.parse(
      readFileSync(
        new URL('../migrations/zzzz_20260812_missing_paths.json', import.meta.url),
        'utf8',
      ),
    ) as { tables: Record<string, unknown> }

    expect(
      Object.keys(after.tables).filter((table) => !(table in before.tables)),
    ).toEqual(['public.missing_paths'])
    expect(
      Object.keys(before.tables).filter((table) => !(table in after.tables)),
    ).toEqual([])
    expect(
      Object.keys(before.tables).filter(
        (table) => JSON.stringify(before.tables[table]) !== JSON.stringify(after.tables[table]),
      ),
    ).toEqual(['public.payload_locked_documents_rels'])
  })

  it('uses one atomic execution in each direction', async () => {
    const upArgs = migrationArgs()
    await up(upArgs.args)
    expect(upArgs.execute).toHaveBeenCalledOnce()

    const downArgs = migrationArgs()
    await down(downArgs.args)
    expect(downArgs.execute).toHaveBeenCalledOnce()
  })

  it('contains only MissingPaths and its locked-document relationship DDL', () => {
    const migration = readFileSync(
      new URL('../migrations/20260812_zzz_missing_paths.ts', import.meta.url),
      'utf8',
    )

    expect(migration).toContain('CREATE TABLE "missing_paths"')
    expect(migration).toContain('CREATE UNIQUE INDEX "missing_paths_path_idx"')
    expect(migration).toContain('ADD COLUMN "missing_paths_id" integer')
    expect(migration).toContain('payload_locked_documents_rels_missing_paths_fk')
    expect(migration).toContain('payload_locked_documents_rels_missing_paths_id_idx')

    expect(migration).not.toContain('"users_sessions"')
    expect(migration).not.toContain('"rock_connection_signup_nonces"')
    expect(migration).not.toContain('"rock_connection_signup_rate_limits"')
    expect(migration).not.toContain('"site_feedback_rate_limits"')
    expect(migration).not.toContain('ALTER TABLE "site_settings"')
  })

  it('removes the locked-document relation before dropping its target table', () => {
    const migration = readFileSync(
      new URL('../migrations/20260812_zzz_missing_paths.ts', import.meta.url),
      'utf8',
    )
    const downSql = migration.slice(migration.indexOf('export async function down'))

    expect(downSql.indexOf('DROP CONSTRAINT')).toBeLessThan(
      downSql.indexOf('DROP TABLE "missing_paths"'),
    )
  })
})
