import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

import {
  ROCK_CONNECTION_SIGNUP_DOWN_SQL,
  ROCK_CONNECTION_SIGNUP_UP_SQL,
  down,
  up,
} from './20260804_rock_connection_signup'

function migrationArgs(execute = vi.fn().mockResolvedValue(undefined)) {
  return {
    args: {
      db: { execute },
      payload: {},
      req: {},
    } as never,
    execute,
  }
}

describe('Rock connection signup migration', () => {
  it('ships a snapshot containing both form schemas and security-ledger tables', () => {
    const snapshot = JSON.parse(
      readFileSync(
        new URL('./20260804_rock_connection_signup.json', import.meta.url),
        'utf8',
      ),
    ) as {
      tables: Record<
        string,
        {
          columns: Record<string, { notNull: boolean; type: string }>
          checkConstraints: Record<string, unknown>
          compositePrimaryKeys: Record<string, unknown>
        }
      >
      enums: Record<string, { values: string[] }>
    }
    expect(
      snapshot.tables['public.pages_blocks_form_embed'].columns.source_type,
    ).toMatchObject({
      type: 'enum_pages_blocks_form_embed_source_type',
      notNull: true,
    })
    expect(
      snapshot.tables['public._pages_v_blocks_form_embed'].columns
        .rock_connection_block_guid,
    ).toMatchObject({ type: 'varchar', notNull: false })
    expect(snapshot.tables).toHaveProperty(
      'public.rock_connection_signup_nonces',
    )
    expect(snapshot.tables).toHaveProperty(
      'public.rock_connection_signup_rate_limits',
    )
    expect(
      snapshot.tables['public.rock_connection_signup_rate_limits']
        .compositePrimaryKeys,
    ).toHaveProperty('rock_connection_signup_rate_limits_pk')
    expect(
      snapshot.enums['public.enum_pages_blocks_form_embed_source_type'].values,
    ).toEqual(['workflow', 'connectionOpportunity'])
  })

  it('executes one atomic up batch through the migration database', async () => {
    const { args, execute } = migrationArgs()
    await up(args)
    expect(execute).toHaveBeenCalledOnce()
  })

  it('expands and backfills both form table families without rewriting workflow GUIDs', () => {
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('pages_blocks_form_embed')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('_pages_v_blocks_form_embed')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('ADD COLUMN IF NOT EXISTS "source_type"')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('ADD COLUMN IF NOT EXISTS "rock_connection_block_guid"')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toMatch(/SET "source_type" = 'workflow'[\s\S]+WHERE "source_type" IS NULL/g)
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).not.toMatch(/SET\s+"rock_workflow_guid"\s*=\s*(?!NULL)/)
  })

  it('targets only the reviewed Newish candidate in live and version rows', () => {
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain("lower(p.\"slug\") = 'newish'")
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain("lower(v.\"version_slug\") = 'newish'")
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('b."_path" = \'layout\'')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('b."_order" = 5')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain("b.\"layout\"::text = 'centered'")
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('00778880-81fe-4871-aa91-7c81783b8c4d')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('495cda8e-60fe-4f77-a452-932b460fb44c')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain("SET \"source_type\" = 'connectionOpportunity'")
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('"rock_workflow_guid" = NULL')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('candidate manifest')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain("'latest', v.\"latest\"")
    const correctionStatements = ROCK_CONNECTION_SIGNUP_UP_SQL.match(
      /UPDATE "(?:pages|_pages_v)_blocks_form_embed" b[\s\S]*?b\."layout"::text = 'centered';/g,
    )
    expect(correctionStatements).toHaveLength(2)
    expect(correctionStatements?.[0]).toContain("lower(p.\"slug\") = 'newish'")
    expect(correctionStatements?.[1]).toContain("lower(v.\"version_slug\") = 'newish'")
  })

  it('allows empty databases but aborts duplicate and mismatched Newish candidates', () => {
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('live_candidate_count > 1')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('live_candidate_count <> live_old_guid_count')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('HAVING count(*) > 1')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).not.toContain('live_candidate_count = 0')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('RAISE EXCEPTION')
  })

  it('asserts valid discriminators then adds equivalent constraints and lookup indexes', () => {
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('invalid live form embed source rows')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('invalid version form embed source rows')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('pages_blocks_form_embed_source_identity_check')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('_pages_v_blocks_form_embed_source_identity_check')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('pages_blocks_form_embed_connection_lookup_idx')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('_pages_v_blocks_form_embed_connection_lookup_idx')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL.match(/"rock_workflow_guid" IS NOT NULL/g)).toHaveLength(4)
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL.match(/"rock_connection_block_guid" IS NOT NULL/g)).toHaveLength(4)
  })

  it('creates nonce and rate tables that match U2 with bounded expiry cleanup', () => {
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('CREATE TABLE IF NOT EXISTS "rock_connection_signup_nonces"')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('"nonce_digest" varchar(64) PRIMARY KEY')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('CREATE TABLE IF NOT EXISTS "rock_connection_signup_rate_limits"')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('PRIMARY KEY ("bucket_digest", "route_class", "window_started_at")')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('LIMIT 100')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain('rock_connection_signup_cleanup_expired')
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain("SET LOCAL lock_timeout = '5s'")
    expect(ROCK_CONNECTION_SIGNUP_UP_SQL).toContain("SET LOCAL statement_timeout = '30s'")
  })

  it('refuses down before any DDL when either table family has Connection rows', () => {
    const guard = ROCK_CONNECTION_SIGNUP_DOWN_SQL.indexOf('Cannot roll back Rock Connection Signup')
    const firstDdl = ROCK_CONNECTION_SIGNUP_DOWN_SQL.indexOf('DROP TRIGGER')
    expect(guard).toBeGreaterThan(-1)
    expect(firstDdl).toBeGreaterThan(guard)
    expect(ROCK_CONNECTION_SIGNUP_DOWN_SQL.slice(0, firstDdl)).toContain('pages_blocks_form_embed')
    expect(ROCK_CONNECTION_SIGNUP_DOWN_SQL.slice(0, firstDdl)).toContain('_pages_v_blocks_form_embed')
  })

  it('keeps Workflow-only down lossless and makes a forced database assertion fail the unit', async () => {
    expect(ROCK_CONNECTION_SIGNUP_DOWN_SQL).not.toContain('DROP COLUMN "rock_workflow_guid"')
    const execute = vi.fn().mockRejectedValue(new Error('forced assertion failure'))
    await expect(up(migrationArgs(execute).args)).rejects.toThrow('forced assertion failure')
    expect(execute).toHaveBeenCalledOnce()

    const downArgs = migrationArgs()
    await down(downArgs.args)
    expect(downArgs.execute).toHaveBeenCalledOnce()
  })
})
