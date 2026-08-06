import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  UPCOMING_EVENTS_BLOCK_DOWN_SQL,
  UPCOMING_EVENTS_BLOCK_UP_SQL,
} from '@/migrations/20260805_185400_upcoming_events_block'

const databaseUrl = process.env.UPCOMING_EVENTS_BLOCK_MIGRATION_TEST_DATABASE_URL
const describeIfDatabase = databaseUrl ? describe : describe.skip

function assertDisposableDatabase(url: string): void {
  const parsed = new URL(url)
  const isLocal = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'

  if (!isLocal || parsed.pathname !== '/upcoming_events_block_test') {
    throw new Error(
      'UPCOMING_EVENTS_BLOCK_MIGRATION_TEST_DATABASE_URL must target the local upcoming_events_block_test database',
    )
  }
}

describeIfDatabase('upcoming events block migration', () => {
  let client: Client

  beforeAll(async () => {
    assertDisposableDatabase(databaseUrl!)
    client = new Client({ connectionString: databaseUrl })
    await client.connect()
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    await client.query(`
      CREATE TABLE campuses (id integer PRIMARY KEY);
      CREATE TABLE pages (id integer PRIMARY KEY, slug text NOT NULL);
      CREATE TABLE _pages_v (
        id serial PRIMARY KEY,
        parent_id integer NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL
      );

      CREATE TABLE pages_blocks_latest_sermon (
        _order integer NOT NULL,
        _parent_id integer NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        _path text NOT NULL,
        id varchar PRIMARY KEY NOT NULL
      );
      CREATE TABLE pages_blocks_cta (
        _order integer NOT NULL,
        _parent_id integer NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        _path text NOT NULL,
        id varchar PRIMARY KEY NOT NULL
      );
      CREATE TABLE _pages_v_blocks_latest_sermon (
        _order integer NOT NULL,
        _parent_id integer NOT NULL REFERENCES _pages_v(id) ON DELETE CASCADE,
        _path text NOT NULL,
        id serial PRIMARY KEY NOT NULL
      );
      CREATE TABLE _pages_v_blocks_cta (
        _order integer NOT NULL,
        _parent_id integer NOT NULL REFERENCES _pages_v(id) ON DELETE CASCADE,
        _path text NOT NULL,
        id serial PRIMARY KEY NOT NULL
      );

      INSERT INTO pages (id, slug) VALUES (1, 'home'), (2, 'about');
      INSERT INTO _pages_v (id, parent_id, created_at)
        VALUES (10, 1, '2026-08-01T00:00:00Z'), (11, 1, '2026-08-05T00:00:00Z');
      SELECT setval('_pages_v_id_seq', 11, true);

      INSERT INTO pages_blocks_latest_sermon (_order, _parent_id, _path, id)
        VALUES (1, 1, 'layout', 'sermon-home');
      INSERT INTO pages_blocks_cta (_order, _parent_id, _path, id)
        VALUES (2, 1, 'layout', 'cta-home'), (2, 2, 'layout', 'cta-about');
      INSERT INTO _pages_v_blocks_latest_sermon (_order, _parent_id, _path)
        VALUES (1, 11, 'version.layout');
      INSERT INTO _pages_v_blocks_cta (_order, _parent_id, _path)
        VALUES (2, 10, 'version.layout'), (2, 11, 'version.layout');
    `)
  })

  afterAll(async () => {
    if (client) {
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
      await client.end()
    }
  })

  it('adds the block after the latest sermon and preserves following block order', async () => {
    await client.query(UPCOMING_EVENTS_BLOCK_UP_SQL)

    const liveBlock = await client.query(`
      SELECT _order, _path, id, eyebrow, heading, campus_filter_id
      FROM pages_blocks_upcoming_events
      WHERE _parent_id = 1
    `)
    expect(liveBlock.rows).toEqual([
      {
        _order: 2,
        _path: 'layout',
        id: 'upcoming-events-home',
        eyebrow: 'What’s on',
        heading: 'Upcoming events',
        campus_filter_id: null,
      },
    ])

    const liveCtas = await client.query(
      'SELECT _parent_id, _order FROM pages_blocks_cta ORDER BY _parent_id',
    )
    expect(liveCtas.rows).toEqual([
      { _parent_id: 1, _order: 3 },
      { _parent_id: 2, _order: 2 },
    ])

    const versionBlock = await client.query(`
      SELECT _order, _parent_id, _path, eyebrow, heading, campus_filter_id, _uuid
      FROM _pages_v_blocks_upcoming_events
    `)
    expect(versionBlock.rows).toEqual([
      {
        _order: 2,
        _parent_id: 11,
        _path: 'version.layout',
        eyebrow: 'What’s on',
        heading: 'Upcoming events',
        campus_filter_id: null,
        _uuid: 'upcoming-events-home',
      },
    ])

    const versionCtas = await client.query(
      'SELECT _parent_id, _order FROM _pages_v_blocks_cta ORDER BY _parent_id',
    )
    expect(versionCtas.rows).toEqual([
      { _parent_id: 10, _order: 2 },
      { _parent_id: 11, _order: 3 },
    ])
  })

  it('sets the optional campus filter to null when its campus is deleted', async () => {
    await client.query('INSERT INTO campuses (id) VALUES (7)')
    await client.query(
      'UPDATE pages_blocks_upcoming_events SET campus_filter_id = 7 WHERE _parent_id = 1',
    )
    await client.query('DELETE FROM campuses WHERE id = 7')

    const result = await client.query(
      'SELECT campus_filter_id FROM pages_blocks_upcoming_events WHERE _parent_id = 1',
    )
    expect(result.rows[0].campus_filter_id).toBeNull()
  })

  it('removes both block tables on rollback', async () => {
    await client.query(UPCOMING_EVENTS_BLOCK_DOWN_SQL)

    const result = await client.query(`
      SELECT to_regclass('public.pages_blocks_upcoming_events') AS live,
        to_regclass('public._pages_v_blocks_upcoming_events') AS versions
    `)
    expect(result.rows[0]).toEqual({ live: null, versions: null })
  })
})
