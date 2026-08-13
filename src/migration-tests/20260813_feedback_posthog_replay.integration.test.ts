import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  FEEDBACK_POSTHOG_REPLAY_DOWN_SQL,
  FEEDBACK_POSTHOG_REPLAY_UP_SQL,
} from '../migrations/20260813_110000_feedback_posthog_replay'

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

describe.skipIf(!databaseUrl)('feedback PostHog replay migration on PostgreSQL', () => {
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
      CREATE TABLE feedback_submissions (
        id serial PRIMARY KEY,
        comment varchar NOT NULL
      );
      INSERT INTO feedback_submissions (comment) VALUES ('Keep this feedback');
    `)
  }

  it('preserves existing rows and refuses rollback after replay metadata is captured', async () => {
    await resetFixture()
    await client.query(FEEDBACK_POSTHOG_REPLAY_UP_SQL)

    const existing = await client.query(
      'SELECT comment, post_hog_session_id, post_hog_replay_url FROM feedback_submissions',
    )
    expect(existing.rows).toEqual([
      {
        comment: 'Keep this feedback',
        post_hog_session_id: null,
        post_hog_replay_url: null,
      },
    ])

    await client.query(`
      UPDATE feedback_submissions
      SET post_hog_session_id = 'session-id',
          post_hog_replay_url = 'https://us.posthog.com/project/token/replay/session-id?t=1';
    `)

    await expect(client.query(FEEDBACK_POSTHOG_REPLAY_DOWN_SQL)).rejects.toThrow(
      'Cannot roll back feedback PostHog replay metadata while captured links exist',
    )
    const retained = await client.query(
      'SELECT post_hog_session_id, post_hog_replay_url FROM feedback_submissions',
    )
    expect(retained.rows[0]).toEqual({
      post_hog_session_id: 'session-id',
      post_hog_replay_url:
        'https://us.posthog.com/project/token/replay/session-id?t=1',
    })
  })

  it('rolls back unused columns and can reapply them', async () => {
    await resetFixture()
    await client.query(FEEDBACK_POSTHOG_REPLAY_UP_SQL)
    await client.query(FEEDBACK_POSTHOG_REPLAY_DOWN_SQL)

    const removed = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'feedback_submissions'
        AND column_name IN ('post_hog_session_id', 'post_hog_replay_url')
    `)
    expect(removed.rows).toEqual([])

    await client.query(FEEDBACK_POSTHOG_REPLAY_UP_SQL)
  })
})
