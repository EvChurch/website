import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import {
  SITE_FEEDBACK_DOWN_SQL,
  SITE_FEEDBACK_UP_SQL,
  down,
  up,
} from '../migrations/20260812_site_feedback'

function migrationArgs(execute = vi.fn().mockResolvedValue(undefined)) {
  return {
    args: { db: { execute }, payload: {}, req: {} } as never,
    execute,
  }
}

describe('Site feedback migration', () => {
  it('ships a snapshot for feedback, settings, and the dedicated rate-limit ledger', () => {
    const snapshot = JSON.parse(
      readFileSync(
        new URL('../migrations/20260812_site_feedback.json', import.meta.url),
        'utf8',
      ),
    ) as {
      tables: Record<
        string,
        {
          columns: Record<string, { notNull: boolean; type: string }>
          indexes: Record<string, { isUnique: boolean }>
          uniqueConstraints: Record<string, unknown>
        }
      >
    }

    expect(snapshot.tables['public.feedback_submissions'].columns).toMatchObject({
      comment: { type: 'varchar', notNull: true },
      email: { type: 'varchar', notNull: false },
      source_url: { type: 'varchar', notNull: true },
      client_address_digest: { type: 'varchar', notNull: true },
      user_agent: { type: 'varchar', notNull: false },
      updated_at: { type: 'timestamp(3) with time zone', notNull: true },
      created_at: { type: 'timestamp(3) with time zone', notNull: true },
    })
    expect(snapshot.tables['public.site_settings'].columns).toMatchObject({
      feedback_enabled: { type: 'boolean', notNull: false },
      feedback_banner_copy: { type: 'varchar', notNull: false },
      feedback_cta_label: { type: 'varchar', notNull: false },
      feedback_modal_title: { type: 'varchar', notNull: false },
      feedback_modal_intro: { type: 'varchar', notNull: false },
      feedback_dismissal_version: { type: 'varchar', notNull: false },
      feedback_end_date: {
        type: 'timestamp(3) with time zone',
        notNull: false,
      },
    })

    const ledger = snapshot.tables['public.site_feedback_rate_limits']
    expect(ledger.columns).toMatchObject({
      id: { type: 'serial', notNull: true },
      bucket_digest: { type: 'varchar', notNull: true },
      window_started_at: {
        type: 'timestamp(3) with time zone',
        notNull: true,
      },
      count: { type: 'integer', notNull: true },
      expires_at: { type: 'timestamp(3) with time zone', notNull: true },
    })
    expect(ledger.uniqueConstraints).toHaveProperty(
      'site_feedback_rate_limits_bucket_window_unique',
    )
    expect(ledger.indexes).toHaveProperty(
      'site_feedback_rate_limits_expires_at_idx',
    )
  })

  it('uses one atomic migration batch in each direction', async () => {
    const upArgs = migrationArgs()
    await up(upArgs.args)
    expect(upArgs.execute).toHaveBeenCalledOnce()

    const downArgs = migrationArgs()
    await down(downArgs.args)
    expect(downArgs.execute).toHaveBeenCalledOnce()
  })

  it('creates the schema without replacing an existing Site Settings row', () => {
    expect(SITE_FEEDBACK_UP_SQL).toContain('CREATE TABLE IF NOT EXISTS "feedback_submissions"')
    expect(SITE_FEEDBACK_UP_SQL).toContain(
      'CREATE TABLE IF NOT EXISTS "site_feedback_rate_limits"',
    )
    expect(SITE_FEEDBACK_UP_SQL).toContain('ALTER TABLE "site_settings"')
    expect(SITE_FEEDBACK_UP_SQL).toContain('ADD COLUMN IF NOT EXISTS')
    expect(SITE_FEEDBACK_UP_SQL).not.toMatch(
      /(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?"site_settings"/i,
    )
  })

  it('matches the handler ledger contract and documents bounded cleanup', () => {
    expect(SITE_FEEDBACK_UP_SQL).toContain('"id" serial PRIMARY KEY')
    expect(SITE_FEEDBACK_UP_SQL).toContain('"bucket_digest" varchar NOT NULL')
    expect(SITE_FEEDBACK_UP_SQL).toContain(
      '"window_started_at" timestamp(3) with time zone NOT NULL',
    )
    expect(SITE_FEEDBACK_UP_SQL).toContain('"count" integer NOT NULL DEFAULT 1')
    expect(SITE_FEEDBACK_UP_SQL).toContain(
      'UNIQUE ("bucket_digest", "window_started_at")',
    )
    expect(SITE_FEEDBACK_UP_SQL).toContain(
      'site_feedback_rate_limits_expires_at_idx',
    )
    expect(SITE_FEEDBACK_UP_SQL).toContain('bounded cleanup: oldest 100 expired')
    expect(SITE_FEEDBACK_UP_SQL).toContain("SET LOCAL lock_timeout = '5s'")
    expect(SITE_FEEDBACK_UP_SQL).toContain(
      "SET LOCAL statement_timeout = '30s'",
    )
  })

  it('refuses destructive rollback before any DDL when feedback exists', () => {
    const guard = SITE_FEEDBACK_DOWN_SQL.indexOf(
      'Cannot roll back Site Feedback while submissions exist',
    )
    const firstDdl = SITE_FEEDBACK_DOWN_SQL.indexOf('DROP TABLE')

    expect(guard).toBeGreaterThan(-1)
    expect(firstDdl).toBeGreaterThan(guard)
    expect(SITE_FEEDBACK_DOWN_SQL.slice(0, firstDdl)).toContain(
      'IF EXISTS (SELECT 1 FROM "feedback_submissions")',
    )
  })

  it('propagates database assertion failures', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('forced SQL failure'))
    await expect(down(migrationArgs(execute).args)).rejects.toThrow(
      'forced SQL failure',
    )
    expect(execute).toHaveBeenCalledOnce()
  })
})
