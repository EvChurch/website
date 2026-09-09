import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { WEEKEND_TOGETHER_UP_SQL } from '@/migrations/20260910_070000_weekend_together_2026'

// Explicit opt-in; Unix socket only and a fixed worktree database. All rows are
// temporary and disappear on disconnect, leaving the real events table intact.
describe.skipIf(!process.env.WEEKEND_TOGETHER_LOCAL_TEST)('event website overrides on PostgreSQL', () => {
  const client = new Client({ host: '/var/run/postgresql', database: 'evchurch_dev_wt_issue_293_weekend_together' })

  beforeAll(async () => {
    await client.connect()
    const result = await client.query('select current_database() as database, inet_server_addr() as address')
    expect(result.rows[0]).toEqual({ database: 'evchurch_dev_wt_issue_293_weekend_together', address: null })
    await client.query('CREATE TEMP TABLE events (rock_event_id integer, slug text, start_date timestamptz, end_date timestamptz, summary jsonb, updated_at timestamptz)')
  })

  afterAll(async () => { await client.end() })

  it('stores the programme in reusable override fields that survive a Rock refresh', async () => {
    const originalSummary = { root: { type: 'root', version: 1, format: '' as const, direction: null, indent: 0,
      children: [{ type: 'paragraph', version: 1, children: [{ type: 'text', text: 'Original description' }] }] } }
    await client.query(`INSERT INTO events VALUES
      (40, 'weekend-together', '2026-11-06T06:00:00Z', null, $1, null),
      (41, 'another-event', '2026-11-06T06:00:00Z', null, $1, null),
      (40, 'weekend-together', '2027-11-06T06:00:00Z', null, $1, null)`, [originalSummary])

    await client.query(WEEKEND_TOGETHER_UP_SQL)

    const migrated = (await client.query('SELECT * FROM events ORDER BY start_date, rock_event_id')).rows
    expect(migrated[0].summary).toEqual(originalSummary)
    expect(migrated[0].end_date).toBeNull()
    expect(migrated[0].website_summary.root.children[0]).toEqual(originalSummary.root.children[0])
    expect(JSON.stringify(migrated[0].website_summary)).toContain('Weekend Together programme')
    expect(migrated.slice(1).every(row => row.website_summary === null && row.updated_at === null)).toBe(true)

    const rockSummary = { root: { ...originalSummary.root, children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Refreshed Rock description' }] }] } }
    await client.query('UPDATE events SET summary = $1, end_date = null WHERE rock_event_id = 40 AND start_date = $2', [rockSummary, '2026-11-06T06:00:00Z'])
    const afterSync = (await client.query('SELECT * FROM events WHERE rock_event_id = 40 AND start_date = $1', ['2026-11-06T06:00:00Z'])).rows[0]
    expect(afterSync.summary).toEqual(rockSummary)
    expect(JSON.stringify(afterSync.website_summary)).toContain('Weekend Together programme')

    await client.query(WEEKEND_TOGETHER_UP_SQL)
    const afterRepeat = (await client.query('SELECT * FROM events WHERE rock_event_id = 40 AND start_date = $1', ['2026-11-06T06:00:00Z'])).rows[0]
    expect(afterRepeat.website_summary).toEqual(afterSync.website_summary)
    expect(afterRepeat.updated_at).toEqual(afterSync.updated_at)
  })
})
