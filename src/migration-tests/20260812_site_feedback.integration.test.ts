import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  SITE_FEEDBACK_DOWN_SQL,
  SITE_FEEDBACK_UP_SQL,
} from '../migrations/20260812_site_feedback'

const databaseUrl = process.env.SITE_FEEDBACK_MIGRATION_TEST_DATABASE_URL

function assertDisposableDatabase(value: string): void {
  const url = new URL(value)
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.pathname !== '/site_feedback_test'
  ) {
    throw new Error(
      'SITE_FEEDBACK_MIGRATION_TEST_DATABASE_URL must target local database site_feedback_test',
    )
  }
}

describe.skipIf(!databaseUrl)('Site feedback migration on PostgreSQL', () => {
  let client: Client

  beforeAll(async () => {
    assertDisposableDatabase(databaseUrl as string)
    client = new Client({ connectionString: databaseUrl })
    await client.connect()
  })

  afterAll(async () => {
    await client?.end()
  })

  async function resetFixture(): Promise<void> {
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    await client.query(`
      CREATE TABLE site_settings (
        id serial PRIMARY KEY,
        analytics_id varchar,
        updated_at timestamp(3) with time zone,
        created_at timestamp(3) with time zone
      );
      INSERT INTO site_settings (analytics_id) VALUES ('G-EXISTING');
    `)
  }

  it('applies without replacing existing settings and enforces ledger uniqueness', async () => {
    await resetFixture()
    await client.query(SITE_FEEDBACK_UP_SQL)

    const settings = await client.query(
      'SELECT id, analytics_id, feedback_enabled FROM site_settings',
    )
    expect(settings.rows).toEqual([
      { id: 1, analytics_id: 'G-EXISTING', feedback_enabled: false },
    ])

    await client.query(`
      INSERT INTO site_feedback_rate_limits
        (bucket_digest, window_started_at, count, expires_at)
      VALUES
        ('digest', '2026-08-12T00:00:00Z', 1, '2026-08-12T00:20:00Z');
    `)
    await expect(
      client.query(`
        INSERT INTO site_feedback_rate_limits
          (bucket_digest, window_started_at, count, expires_at)
        VALUES
          ('digest', '2026-08-12T00:00:00Z', 1, '2026-08-12T00:20:00Z');
      `),
    ).rejects.toMatchObject({ code: '23505' })
  })

  it('rolls down an unused schema and can be reapplied', async () => {
    await resetFixture()
    await client.query(SITE_FEEDBACK_UP_SQL)
    await client.query(SITE_FEEDBACK_DOWN_SQL)

    const removed = await client.query(`
      SELECT to_regclass('public.feedback_submissions') AS feedback,
             to_regclass('public.site_feedback_rate_limits') AS rate_limits
    `)
    expect(removed.rows[0]).toEqual({ feedback: null, rate_limits: null })

    await client.query(SITE_FEEDBACK_UP_SQL)
    const reapplied = await client.query(
      "SELECT to_regclass('public.feedback_submissions')::text AS table_name",
    )
    expect(reapplied.rows[0].table_name).toBe('feedback_submissions')
  })

  it('refuses down while submissions exist without changing the schema', async () => {
    await resetFixture()
    await client.query(SITE_FEEDBACK_UP_SQL)
    await client.query(`
      INSERT INTO feedback_submissions
        (comment, source_url, client_address_digest)
      VALUES
        ('Keep this submission', 'https://ev.church/', 'digest');
    `)

    await expect(client.query(SITE_FEEDBACK_DOWN_SQL)).rejects.toThrow(
      'Cannot roll back Site Feedback while submissions exist',
    )

    const retained = await client.query(
      'SELECT comment FROM feedback_submissions ORDER BY id',
    )
    expect(retained.rows).toEqual([{ comment: 'Keep this submission' }])
  })
})
