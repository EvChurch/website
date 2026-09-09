import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { WEEKEND_TOGETHER_UP_SQL } from '@/migrations/20260910_070000_weekend_together_2026'
import { applyWeekendTogether2026 } from '@/content/weekend-together-2026'

// Explicit opt-in; Unix socket only and a fixed worktree database. All rows are
// temporary and disappear on disconnect, leaving the real events table intact.
describe.skipIf(!process.env.WEEKEND_TOGETHER_LOCAL_TEST)('Weekend Together migration on PostgreSQL', () => {
  const client = new Client({ host: '/var/run/postgresql', database: 'evchurch_dev_wt_issue_293_weekend_together' })
  beforeAll(async () => {
    await client.connect()
    const result = await client.query('select current_database() as database, inet_server_addr() as address')
    expect(result.rows[0]).toEqual({ database: 'evchurch_dev_wt_issue_293_weekend_together', address: null })
    await client.query('CREATE TEMP TABLE events (rock_event_id integer, slug text, start_date timestamptz, end_date timestamptz, summary jsonb, updated_at timestamptz)')
  })
  afterAll(async () => { await client.end() })

  it('updates only the intended occurrence, matches sync content, and is repeatable', async () => {
    const summary = { root: { type: 'root', version: 1, format: '' as const, direction: null, indent: 0,
      children: [{ type: 'paragraph', version: 1, children: [{ type: 'text', text: 'Original description' }] }] } }
    await client.query(`INSERT INTO events VALUES
      (40, 'weekend-together', '2026-11-06T06:00:00Z', null, $1, null),
      (41, 'another-event', '2026-11-06T06:00:00Z', null, $1, null),
      (40, 'weekend-together', '2027-11-06T06:00:00Z', null, $1, null)`, [summary])
    const first = await client.query(WEEKEND_TOGETHER_UP_SQL)
    expect(first.rowCount).toBe(1)
    const saved = (await client.query('SELECT * FROM events ORDER BY start_date, rock_event_id')).rows
    const expected = applyWeekendTogether2026({ rockEventId: 40, slug: 'weekend-together', startDate: '2026-11-06T06:00:00.000Z', summary, endDate: null })
    expect(saved[0].summary).toEqual(expected.summary)
    expect(saved[0].end_date.toISOString()).toBe(expected.endDate)
    expect(saved.slice(1).every(row => row.end_date === null && row.updated_at === null)).toBe(true)
    expect((await client.query(WEEKEND_TOGETHER_UP_SQL)).rowCount).toBe(0)
    expect((await client.query('SELECT * FROM events ORDER BY start_date, rock_event_id')).rows).toEqual(saved)
  })
})
