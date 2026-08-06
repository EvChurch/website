import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  EXACT_CAMPUS_MAP_LOCATIONS_DOWN_SQL,
  EXACT_CAMPUS_MAP_LOCATIONS_UP_SQL,
} from '@/migrations/20260806_103317_exact_campus_map_locations'

const databaseUrl = process.env.CAMPUS_MAP_LOCATIONS_MIGRATION_TEST_DATABASE_URL
const describeIfDatabase = databaseUrl ? describe : describe.skip

function assertDisposableDatabase(url: string): void {
  const parsed = new URL(url)
  const isLocal =
    parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'

  if (!isLocal || parsed.pathname !== '/campus_map_locations_test') {
    throw new Error(
      'CAMPUS_MAP_LOCATIONS_MIGRATION_TEST_DATABASE_URL must target the local campus_map_locations_test database',
    )
  }
}

describeIfDatabase('exact campus map locations migration', () => {
  let client: Client

  beforeAll(async () => {
    assertDisposableDatabase(databaseUrl!)
    client = new Client({ connectionString: databaseUrl })
    await client.connect()
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    await client.query(`
      CREATE TABLE campuses (
        id serial PRIMARY KEY,
        slug varchar NOT NULL UNIQUE,
        page_content_map_url varchar
      );

      INSERT INTO campuses (slug, page_content_map_url) VALUES
        ('north', 'https://www.google.com/maps?q=9-11+Rothwell+Avenue+Rosedale+Auckland'),
        ('central', 'https://www.google.com/maps?q=80+Olsen+Avenue+Hillsborough+Auckland'),
        ('unichurch', 'https://www.google.com/maps?q=24+Princes+Street+Auckland'),
        ('west', 'https://www.google.com/maps?q=West+Auckland'),
        ('custom', 'https://www.google.com/maps/place/Editor-selected-location');
    `)
  })

  afterAll(async () => {
    if (client) {
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
      await client.end()
    }
  })

  it('replaces only the original seeded URLs with exact Google place IDs', async () => {
    await client.query(EXACT_CAMPUS_MAP_LOCATIONS_UP_SQL)

    const result = await client.query(
      'SELECT slug, page_content_map_url FROM campuses ORDER BY slug',
    )

    expect(result.rows).toEqual([
      {
        slug: 'central',
        page_content_map_url:
          'https://www.google.com/maps/place/?q=place_id%3AChIJAYvdBVVGDW0ReTxTjSRowE8',
      },
      {
        slug: 'custom',
        page_content_map_url:
          'https://www.google.com/maps/place/Editor-selected-location',
      },
      {
        slug: 'north',
        page_content_map_url:
          'https://www.google.com/maps/place/?q=place_id%3AChIJ4Y3qfXc5DW0Rs-PGrYhrQ_U',
      },
      {
        slug: 'unichurch',
        page_content_map_url:
          'https://www.google.com/maps/place/?q=place_id%3AChIJVxR51PxHDW0RGv02V7ClS-o',
      },
      {
        slug: 'west',
        page_content_map_url: 'https://www.google.com/maps?q=West+Auckland',
      },
    ])
  })

  it('rolls back only unchanged exact place URLs', async () => {
    await client.query(`
      UPDATE campuses
      SET page_content_map_url = 'https://www.google.com/maps/place/Editor-changed-location'
      WHERE slug = 'north';
    `)
    await client.query(EXACT_CAMPUS_MAP_LOCATIONS_DOWN_SQL)

    const result = await client.query(
      "SELECT slug, page_content_map_url FROM campuses WHERE slug IN ('central', 'north') ORDER BY slug",
    )

    expect(result.rows).toEqual([
      {
        slug: 'central',
        page_content_map_url:
          'https://www.google.com/maps?q=80+Olsen+Avenue+Hillsborough+Auckland',
      },
      {
        slug: 'north',
        page_content_map_url:
          'https://www.google.com/maps/place/Editor-changed-location',
      },
    ])
  })
})
