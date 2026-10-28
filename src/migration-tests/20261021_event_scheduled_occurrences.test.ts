import { describe, expect, it, vi } from 'vitest'
import { PgDialect } from '@payloadcms/db-postgres/drizzle/pg-core'
import { up, down } from '@/migrations/20261021_010000_event_scheduled_occurrences'
import { migrations } from '@/migrations'

describe('event schedule migration', () => {
  it('only adds an idempotent nullable field and retains data on rollback', async () => {
    const execute = vi.fn()
    const args = { db: { execute } } as unknown as Parameters<typeof up>[0]
    await up(args)
    const dialect = new PgDialect()
    expect(dialect.sqlToQuery(execute.mock.calls[0][0]).sql)
      .toBe('ALTER TABLE events ADD COLUMN IF NOT EXISTS scheduled_occurrences jsonb')
    expect(migrations).toContainEqual({ name: '20261021_010000_event_scheduled_occurrences', up, down })
    execute.mockClear()
    await down(args)
    expect(dialect.sqlToQuery(execute.mock.calls[0][0]).sql).toBe('SELECT 1')
  })
})
