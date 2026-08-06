import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  SERVICE_TIMES_BLOCK_DOWN_SQL,
  SERVICE_TIMES_BLOCK_UP_SQL,
} from '@/migrations/20260806_093700_service_times_block'

const databaseUrl = process.env.SERVICE_TIMES_BLOCK_MIGRATION_TEST_DATABASE_URL
const describeIfDatabase = databaseUrl ? describe : describe.skip

function assertDisposableDatabase(url: string): void {
  const parsed = new URL(url)
  const isLocal = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'

  if (!isLocal || parsed.pathname !== '/service_times_block_test') {
    throw new Error(
      'SERVICE_TIMES_BLOCK_MIGRATION_TEST_DATABASE_URL must target the local service_times_block_test database',
    )
  }
}

describeIfDatabase('service times block migration', () => {
  let client: Client

  beforeAll(async () => {
    assertDisposableDatabase(databaseUrl!)
    client = new Client({ connectionString: databaseUrl })
    await client.connect()
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    await client.query(`
      CREATE TABLE pages (id integer PRIMARY KEY, slug text NOT NULL);
      CREATE TABLE _pages_v (
        id serial PRIMARY KEY,
        parent_id integer NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE pages_blocks_hero (
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
      CREATE TABLE _pages_v_blocks_hero (
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
      INSERT INTO pages_blocks_hero (_order, _parent_id, _path, id)
        VALUES (1, 1, 'layout', 'hero-home');
      INSERT INTO pages_blocks_cta (_order, _parent_id, _path, id)
        VALUES (2, 1, 'layout', 'cta-home'), (1, 2, 'layout', 'cta-about');
      INSERT INTO _pages_v_blocks_hero (_order, _parent_id, _path)
        VALUES (1, 11, 'version.layout');
      INSERT INTO _pages_v_blocks_cta (_order, _parent_id, _path)
        VALUES (1, 10, 'version.layout'), (2, 11, 'version.layout');
    `)
  })

  afterAll(async () => {
    if (client) {
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
      await client.end()
    }
  })

  it('adds three service links after the homepage hero in live and latest-version layouts', async () => {
    await client.query(SERVICE_TIMES_BLOCK_UP_SQL)

    const block = await client.query(`
      SELECT _order, _path, id, heading
      FROM pages_blocks_service_times WHERE _parent_id = 1
    `)
    expect(block.rows).toEqual([{
      _order: 2,
      _path: 'layout',
      id: 'service-times-home',
      heading: 'Join us this Sunday',
    }])

    const services = await client.query(`
      SELECT _order, campus, time, href
      FROM pages_blocks_service_times_services
      WHERE _parent_id = 'service-times-home' ORDER BY _order
    `)
    expect(services.rows).toEqual([
      { _order: 1, campus: 'North', time: '10:15 am', href: '/campus/north' },
      { _order: 2, campus: 'Central', time: '10:15 am', href: '/campus/central' },
      { _order: 3, campus: 'Unichurch', time: '5:15 pm', href: '/campus/unichurch' },
    ])

    expect((await client.query("SELECT _order FROM pages_blocks_cta WHERE id = 'cta-home'")).rows)
      .toEqual([{ _order: 3 }])
    expect((await client.query("SELECT _order FROM pages_blocks_cta WHERE id = 'cta-about'")).rows)
      .toEqual([{ _order: 1 }])

    const versionBlock = await client.query(`
      SELECT _order, _parent_id, _path, heading, _uuid
      FROM _pages_v_blocks_service_times
    `)
    expect(versionBlock.rows).toEqual([{
      _order: 2,
      _parent_id: 11,
      _path: 'version.layout',
      heading: 'Join us this Sunday',
      _uuid: 'service-times-home',
    }])

    const versionServices = await client.query(`
      SELECT services._order, services.campus, services.time, services.href, services._uuid
      FROM _pages_v_blocks_service_times_services services
      JOIN _pages_v_blocks_service_times block ON block.id = services._parent_id
      ORDER BY services._order
    `)
    expect(versionServices.rows).toEqual([
      { _order: 1, campus: 'North', time: '10:15 am', href: '/campus/north', _uuid: 'service-times-north' },
      { _order: 2, campus: 'Central', time: '10:15 am', href: '/campus/central', _uuid: 'service-times-central' },
      { _order: 3, campus: 'Unichurch', time: '5:15 pm', href: '/campus/unichurch', _uuid: 'service-times-unichurch' },
    ])

    expect((await client.query('SELECT _parent_id, _order FROM _pages_v_blocks_cta ORDER BY _parent_id')).rows)
      .toEqual([{ _parent_id: 10, _order: 1 }, { _parent_id: 11, _order: 3 }])
  })

  it('removes all block tables on rollback', async () => {
    await client.query(SERVICE_TIMES_BLOCK_DOWN_SQL)

    const result = await client.query(`
      SELECT
        to_regclass('public.pages_blocks_service_times') AS live,
        to_regclass('public.pages_blocks_service_times_services') AS live_services,
        to_regclass('public._pages_v_blocks_service_times') AS versions,
        to_regclass('public._pages_v_blocks_service_times_services') AS version_services
    `)
    expect(result.rows[0]).toEqual({
      live: null,
      live_services: null,
      versions: null,
      version_services: null,
    })
  })
})
