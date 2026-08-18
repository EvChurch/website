import { describe, expect, it, vi } from 'vitest'

import { migrations } from '../migrations'
import { down, up } from '../migrations/20260819_010000_connect_group_comments'

interface RawSql {
  queryChunks: Array<{ value: string[] }>
}

function rawSqlText(value: unknown): string {
  const query = value as RawSql
  return query.queryChunks.flatMap((chunk) => chunk.value).join('')
}

describe('Connect Group comments migration', () => {
  it('creates the comments table with its defaults and lookup indexes', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    await up({ db: { execute } } as never)

    expect(execute).toHaveBeenCalledTimes(1)
    const statement = rawSqlText(execute.mock.calls[0]?.[0])
    expect(statement).toContain('CREATE TABLE "connect_group_comments"')
    expect(statement).toContain('"visibility" varchar NOT NULL DEFAULT \'leaders-and-coaches\'')
    expect(statement).toContain('connect_group_comments_rock_group_id_idx')
    expect(statement).toContain('connect_group_comments_author_rock_person_id_idx')
    expect(statement).toContain('connect_group_comments_deleted_at_idx')
    expect(statement).toContain('connect_group_comments_deleted_by_rock_person_id_idx')
    expect(statement).toContain('connect_group_comments_created_at_idx')
    expect(statement).toContain("SET LOCAL lock_timeout = '5s'")
  })

  it('registers the migration', () => {
    expect(
      migrations.some(
        (migration) => migration.name === '20260819_010000_connect_group_comments',
      ),
    ).toBe(true)
  })

  it('guards rollback before dropping a table containing comments', async () => {
    const execute = vi.fn().mockResolvedValue(undefined)

    await down({ db: { execute } } as never)

    expect(execute).toHaveBeenCalledTimes(1)
    const statement = rawSqlText(execute.mock.calls[0]?.[0])
    const guard = 'IF EXISTS (SELECT 1 FROM "connect_group_comments")'
    const refusal = "RAISE EXCEPTION 'Cannot roll back while Connect Group comments exist'"
    const drop = 'DROP TABLE IF EXISTS "connect_group_comments"'

    expect(statement).toContain(guard)
    expect(statement).toContain(refusal)
    expect(statement.indexOf(guard)).toBeLessThan(statement.indexOf(drop))
    expect(statement.indexOf(refusal)).toBeLessThan(statement.indexOf(drop))
  })
})
