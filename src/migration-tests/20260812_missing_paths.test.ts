import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import {
  down,
  up,
} from '@/migrations/20260812_missing_paths'

function migrationArgs(execute = vi.fn().mockResolvedValue(undefined)) {
  return {
    args: { db: { execute }, payload: {}, req: {} } as never,
    execute,
  }
}

describe('missing paths migration', () => {
  it('ships a snapshot containing only the aggregate register delta', () => {
    const before = JSON.parse(
      readFileSync(
        new URL(
          '../migrations/20260812_daily_bible_readings_api_bible.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as { tables: Record<string, unknown> }
    const after = JSON.parse(
      readFileSync(
        new URL('../migrations/20260812_missing_paths.json', import.meta.url),
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

  it('uses Payload-generated schema SQL through one atomic execution', async () => {
    const upArgs = migrationArgs()
    await up(upArgs.args)
    expect(upArgs.execute).toHaveBeenCalledOnce()

    const downArgs = migrationArgs()
    await down(downArgs.args)
    expect(downArgs.execute).toHaveBeenCalledOnce()
  })

  it('removes the locked-document relation before dropping its target table', () => {
    const migration = readFileSync(
      new URL('../migrations/20260812_missing_paths.ts', import.meta.url),
      'utf8',
    )
    const down = migration.slice(migration.indexOf('export async function down'))

    expect(down.indexOf('DROP CONSTRAINT')).toBeLessThan(
      down.indexOf('DROP TABLE "missing_paths"'),
    )
  })
})
