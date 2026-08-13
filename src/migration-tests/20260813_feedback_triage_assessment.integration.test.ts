import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  FEEDBACK_TRIAGE_ASSESSMENT_DOWN_SQL,
  FEEDBACK_TRIAGE_ASSESSMENT_UP_SQL,
} from '../migrations/20260813_230000_feedback_triage_assessment'

const databaseUrl = process.env.FEEDBACK_TRIAGE_MIGRATION_TEST_DATABASE_URL

function assertDisposableDatabase(value: string): void {
  const url = new URL(value)
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.pathname !== '/feedback_triage_test'
  ) {
    throw new Error(
      'FEEDBACK_TRIAGE_MIGRATION_TEST_DATABASE_URL must target local database feedback_triage_test',
    )
  }
}

describe.skipIf(!databaseUrl)('feedback triage assessment migration on PostgreSQL', () => {
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
      CREATE TYPE enum_feedback_submissions_resolution_status AS ENUM(
        'new', 'planned', 'in-progress', 'resolved', 'wont-fix'
      );
      CREATE TABLE team_members (id serial PRIMARY KEY, full_name varchar NOT NULL);
      CREATE TABLE feedback_submissions (
        id serial PRIMARY KEY,
        comment varchar NOT NULL,
        resolution_status enum_feedback_submissions_resolution_status NOT NULL DEFAULT 'new'
      );
      INSERT INTO feedback_submissions (comment) VALUES ('Existing feedback');
    `)
  }

  it('preserves rows, supports duplicates, and prevents canonical deletion', async () => {
    await resetFixture()
    await client.query(FEEDBACK_TRIAGE_ASSESSMENT_UP_SQL)

    const existing = await client.query(
      'SELECT comment, resolution_status FROM feedback_submissions WHERE id = 1',
    )
    expect(existing.rows).toEqual([
      { comment: 'Existing feedback', resolution_status: 'new' },
    ])

    await client.query(`
      INSERT INTO feedback_submissions
        (comment, resolution_status, classification, duplicate_of_id)
      VALUES ('Same problem', 'duplicate', 'duplicate', 1);
    `)
    await expect(
      client.query('DELETE FROM feedback_submissions WHERE id = 1'),
    ).rejects.toThrow('Cannot delete canonical feedback')
  })

  it('rolls back with safe status mappings and can be reapplied', async () => {
    await resetFixture()
    await client.query(FEEDBACK_TRIAGE_ASSESSMENT_UP_SQL)
    await client.query(`
      INSERT INTO feedback_submissions (comment, resolution_status, classification)
      VALUES ('Approval', 'needs-approval', 'unclear'), ('Copy', 'duplicate', 'duplicate');
    `)
    await client.query(FEEDBACK_TRIAGE_ASSESSMENT_DOWN_SQL)

    const states = await client.query(
      'SELECT comment, resolution_status::text FROM feedback_submissions ORDER BY id',
    )
    expect(states.rows).toEqual([
      { comment: 'Existing feedback', resolution_status: 'new' },
      { comment: 'Approval', resolution_status: 'new' },
      { comment: 'Copy', resolution_status: 'resolved' },
    ])

    await client.query(FEEDBACK_TRIAGE_ASSESSMENT_UP_SQL)
    const columns = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'feedback_submissions' AND column_name = 'duplicate_of_id'
    `)
    expect(columns.rowCount).toBe(1)
  })
})
