import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  CAMPUS_MANAGED_PAGES_DOWN_SQL,
  CAMPUS_MANAGED_PAGES_UP_SQL,
} from '@/migrations/20260805_234700_campus_managed_pages'

const databaseUrl = process.env.CAMPUS_MANAGED_PAGES_MIGRATION_TEST_DATABASE_URL
const describeIfDatabase = databaseUrl ? describe : describe.skip

function assertDisposableDatabase(url: string): void {
  const parsed = new URL(url)
  const isLocal = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'

  if (!isLocal || parsed.pathname !== '/campus_managed_pages_test') {
    throw new Error(
      'CAMPUS_MANAGED_PAGES_MIGRATION_TEST_DATABASE_URL must target the local campus_managed_pages_test database',
    )
  }
}

describeIfDatabase('campus managed pages migration', () => {
  let client: Client

  beforeAll(async () => {
    assertDisposableDatabase(databaseUrl!)
    client = new Client({ connectionString: databaseUrl })
    await client.connect()
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    await client.query(`
      CREATE TABLE campuses (
        id serial PRIMARY KEY,
        name varchar NOT NULL,
        slug varchar NOT NULL UNIQUE,
        address_street varchar,
        address_city varchar,
        address_postal_code varchar,
        description jsonb
      );

      INSERT INTO campuses (id, name, slug, address_street, description) VALUES
        (1, 'Central', 'central', 'Existing Central address', '{"root":{"type":"root","children":[]}}'),
        (2, 'North', 'north', '', NULL),
        (3, 'Unichurch', 'unichurch', NULL, NULL),
        (4, 'West', 'west', NULL, NULL);
      SELECT setval('campuses_id_seq', 4, true);
    `)
  })

  afterAll(async () => {
    if (client) {
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
      await client.end()
    }
  })

  it('backfills the three existing public campus pages without overwriting existing content', async () => {
    await client.query(CAMPUS_MANAGED_PAGES_UP_SQL)

    const campuses = await client.query(`
      SELECT slug, address_street, description, page_content_enabled,
        page_content_brand_name, page_content_service_time_label,
        page_content_hero_image_path, page_content_seo_title
      FROM campuses
      ORDER BY id
    `)

    expect(campuses.rows[0]).toMatchObject({
      slug: 'central',
      address_street: 'Existing Central address',
      page_content_enabled: true,
      page_content_brand_name: 'Ev Central',
      page_content_service_time_label: 'Sunday 10:15 am',
    })
    expect(campuses.rows[0].description).toEqual({ root: { type: 'root', children: [] } })
    expect(campuses.rows[1]).toMatchObject({
      slug: 'north',
      address_street: '9-11 Rothwell Avenue',
      page_content_enabled: true,
      page_content_brand_name: 'Ev North',
      page_content_hero_image_path: '/images/homepage/carousel-c645786c.jpg',
      page_content_seo_title: 'North Campus | Ev Church Auckland',
    })
    expect(campuses.rows[1].description.root.children[0].children[0].text).toContain(
      'North Shore',
    )
    expect(campuses.rows[3]).toMatchObject({
      slug: 'west',
      page_content_enabled: false,
      page_content_brand_name: null,
    })
  })

  it('seeds four gallery images and a self-filtered events block per managed campus', async () => {
    const galleryCounts = await client.query(`
      SELECT campuses.slug, COUNT(images.id)::integer AS image_count
      FROM campuses
      LEFT JOIN campuses_page_content_gallery_images images
        ON images._parent_id = campuses.id
      GROUP BY campuses.slug
      ORDER BY campuses.slug
    `)
    expect(galleryCounts.rows).toEqual([
      { slug: 'central', image_count: 4 },
      { slug: 'north', image_count: 4 },
      { slug: 'unichurch', image_count: 4 },
      { slug: 'west', image_count: 0 },
    ])

    const eventBlocks = await client.query(`
      SELECT campuses.slug, blocks._order, blocks._path,
        blocks.campus_filter_id = campuses.id AS filters_self
      FROM campuses_blocks_upcoming_events blocks
      JOIN campuses ON campuses.id = blocks._parent_id
      ORDER BY campuses.slug
    `)
    expect(eventBlocks.rows).toEqual([
      { slug: 'central', _order: 1, _path: 'layout', filters_self: true },
      { slug: 'north', _order: 1, _path: 'layout', filters_self: true },
      { slug: 'unichurch', _order: 1, _path: 'layout', filters_self: true },
    ])
  })

  it('removes the managed-page schema on rollback', async () => {
    await client.query(CAMPUS_MANAGED_PAGES_DOWN_SQL)

    const result = await client.query(`
      SELECT
        to_regclass('public.campuses_page_content_gallery_images') AS gallery,
        to_regclass('public.campuses_blocks_upcoming_events') AS blocks,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'campuses' AND column_name = 'page_content_enabled'
        ) AS has_page_columns
    `)
    expect(result.rows[0]).toEqual({ gallery: null, blocks: null, has_page_columns: false })
  })
})
