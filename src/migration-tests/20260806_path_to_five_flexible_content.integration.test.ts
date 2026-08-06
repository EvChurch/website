import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  PATH_TO_FIVE_FLEXIBLE_CONTENT_DOWN_SQL,
  PATH_TO_FIVE_FLEXIBLE_CONTENT_UP_SQL,
} from '@/migrations/20260806_130100_path_to_five_flexible_content'

const databaseUrl = process.env.PATH_TO_FIVE_MIGRATION_TEST_DATABASE_URL
const describeIfDatabase = databaseUrl ? describe : describe.skip

function assertDisposableDatabase(url: string): void {
  const parsed = new URL(url)
  const isLocal = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'

  if (!isLocal || parsed.pathname !== '/path_to_five_test') {
    throw new Error(
      'PATH_TO_FIVE_MIGRATION_TEST_DATABASE_URL must target the local path_to_five_test database',
    )
  }
}

describeIfDatabase('path to five flexible content migration', () => {
  let client: Client

  beforeAll(async () => {
    assertDisposableDatabase(databaseUrl!)
    client = new Client({ connectionString: databaseUrl })
    await client.connect()
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    await client.query(`
      CREATE TABLE navigation (
        id serial PRIMARY KEY,
        updated_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE TABLE pages (id integer PRIMARY KEY, slug text NOT NULL);
      CREATE TABLE pages_blocks_form_embed (
        _parent_id integer NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        rock_workflow_guid text
      );
      CREATE TABLE pages_blocks_hero (
        _parent_id integer NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        subtitle text
      );
      CREATE TABLE pages_blocks_cta (
        _parent_id integer NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
        text text
      );
      CREATE TABLE pages_blocks_manual_card_grid (
        id text PRIMARY KEY,
        _parent_id integer NOT NULL REFERENCES pages(id) ON DELETE CASCADE
      );
      CREATE TABLE pages_blocks_manual_card_grid_cards (
        id text PRIMARY KEY,
        _parent_id text NOT NULL REFERENCES pages_blocks_manual_card_grid(id) ON DELETE CASCADE,
        title text,
        href text,
        link_label text
      );
      CREATE TABLE _pages_v (id integer PRIMARY KEY, version_slug text NOT NULL);
      CREATE TABLE _pages_v_blocks_form_embed (
        _parent_id integer NOT NULL REFERENCES _pages_v(id) ON DELETE CASCADE,
        rock_workflow_guid text
      );
      CREATE TABLE _pages_v_blocks_hero (
        _parent_id integer NOT NULL REFERENCES _pages_v(id) ON DELETE CASCADE,
        subtitle text
      );
      CREATE TABLE _pages_v_blocks_cta (
        _parent_id integer NOT NULL REFERENCES _pages_v(id) ON DELETE CASCADE,
        text text
      );
      CREATE TABLE _pages_v_blocks_manual_card_grid (
        id integer PRIMARY KEY,
        _parent_id integer NOT NULL REFERENCES _pages_v(id) ON DELETE CASCADE
      );
      CREATE TABLE _pages_v_blocks_manual_card_grid_cards (
        id integer PRIMARY KEY,
        _parent_id integer NOT NULL REFERENCES _pages_v_blocks_manual_card_grid(id) ON DELETE CASCADE,
        title text,
        href text,
        link_label text
      );
      CREATE TABLE campuses (
        id integer PRIMARY KEY,
        slug text NOT NULL,
        page_content_map_url text,
        page_content_kids_ages text
      );

      INSERT INTO pages (id, slug) VALUES (1, 'visit'), (2, 'contact'), (3, 'home');
      INSERT INTO pages_blocks_form_embed (_parent_id, rock_workflow_guid)
        VALUES (1, 'DE3D06A6-7FCA-41A5-8C37-A485767DE970'), (2, 'other');
      INSERT INTO pages_blocks_hero (_parent_id, subtitle) VALUES
        (3, 'We''re one church family across three Auckland campuses — people captivated by Jesus, grounded in the gospel, and growing in maturity and number. Wherever you''re at with God, there''s a seat here for you.');
      INSERT INTO pages_blocks_cta (_parent_id, text) VALUES
        (1, 'No, no, and no. You''re our guest — nobody will single you out, and the offering is for our church family, not for visitors. Come, watch, and weigh it up for yourself.');
      INSERT INTO pages_blocks_manual_card_grid (id, _parent_id) VALUES ('contact-grid', 2);
      INSERT INTO pages_blocks_manual_card_grid_cards (id, _parent_id, title, href, link_label) VALUES
        ('north-card', 'contact-grid', 'North', 'https://maps.example/north', 'Open in Google Maps'),
        ('central-card', 'contact-grid', 'Central', 'https://maps.example/central', 'Open in Google Maps'),
        ('unichurch-card', 'contact-grid', 'Unichurch', 'https://maps.example/unichurch', 'Open in Google Maps');
      INSERT INTO _pages_v (id, version_slug) VALUES (10, 'visit'), (11, 'home'), (12, 'contact');
      INSERT INTO _pages_v_blocks_form_embed (_parent_id, rock_workflow_guid)
        VALUES (10, 'de3d06a6-7fca-41a5-8c37-a485767de970');
      INSERT INTO _pages_v_blocks_hero (_parent_id, subtitle) VALUES
        (11, 'We''re one church family across three Auckland campuses — people captivated by Jesus, grounded in the gospel, and growing in maturity and number. Wherever you''re at with God, there''s a seat here for you.');
      INSERT INTO _pages_v_blocks_cta (_parent_id, text) VALUES
        (10, 'No, no, and no. You''re our guest — nobody will single you out, and the offering is for our church family, not for visitors. Come, watch, and weigh it up for yourself.');
      INSERT INTO _pages_v_blocks_manual_card_grid (id, _parent_id) VALUES (20, 12);
      INSERT INTO _pages_v_blocks_manual_card_grid_cards (id, _parent_id, title, href, link_label) VALUES
        (21, 20, 'North', 'https://maps.example/north', 'Open in Google Maps');
      INSERT INTO campuses (id, slug, page_content_map_url, page_content_kids_ages) VALUES
        (1, 'north', 'https://maps.example/north', 'Available for ages 1 to 12'),
        (2, 'central', NULL, 'Available for ages 1 to 12'),
        (3, 'elsewhere', 'https://maps.example/elsewhere', 'Editor-selected ages');
    `)
  })

  afterAll(async () => {
    if (client) {
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
      await client.end()
    }
  })

  it('adds editable actions and fallbacks idempotently, then rolls them back', async () => {
    await client.query(PATH_TO_FIVE_FLEXIBLE_CONTENT_UP_SQL)
    await client.query(PATH_TO_FIVE_FLEXIBLE_CONTENT_UP_SQL)

    expect((await client.query(`
      SELECT subtitle FROM pages_blocks_hero WHERE _parent_id = 3
      UNION ALL
      SELECT subtitle FROM _pages_v_blocks_hero WHERE _parent_id = 11
    `)).rows).toEqual([
      { subtitle: "We're one church family across three Auckland campuses, people captivated by Jesus, grounded in the gospel, and growing in maturity and number. Wherever you're at with God, there's a seat here for you." },
      { subtitle: "We're one church family across three Auckland campuses, people captivated by Jesus, grounded in the gospel, and growing in maturity and number. Wherever you're at with God, there's a seat here for you." },
    ])

    expect((await client.query(`
      SELECT text FROM pages_blocks_cta WHERE _parent_id = 1
      UNION ALL
      SELECT text FROM _pages_v_blocks_cta WHERE _parent_id = 10
    `)).rows).toEqual([
      { text: "No, no, and no. You're our guest. Nobody will single you out, and the offering is for our church family, not for visitors. Come, watch, and weigh it up for yourself." },
      { text: "No, no, and no. You're our guest. Nobody will single you out, and the offering is for our church family, not for visitors. Come, watch, and weigh it up for yourself." },
    ])

    expect((await client.query(`
      SELECT fallback_contact_label, fallback_contact_href
      FROM pages_blocks_form_embed WHERE _parent_id = 1
    `)).rows).toEqual([{
      fallback_contact_label: 'Message our welcome team',
      fallback_contact_href: '/contact',
    }])

    expect((await client.query(`
      SELECT title, map_url, href, link_label
      FROM pages_blocks_manual_card_grid_cards
      ORDER BY title
    `)).rows).toEqual([
      { title: 'Central', map_url: 'https://maps.example/central', href: '/campus/central', link_label: 'Learn more about Central Campus' },
      { title: 'North', map_url: 'https://maps.example/north', href: '/campus/north', link_label: 'Learn more about North Campus' },
      { title: 'Unichurch', map_url: 'https://maps.example/unichurch', href: '/campus/unichurch', link_label: 'Learn more about Unichurch' },
    ])
    expect((await client.query(`
      SELECT title, map_url, href, link_label
      FROM _pages_v_blocks_manual_card_grid_cards
    `)).rows).toEqual([{
      title: 'North',
      map_url: 'https://maps.example/north',
      href: '/campus/north',
      link_label: 'Learn more about North Campus',
    }])
    expect((await client.query(`
      SELECT fallback_contact_label, fallback_contact_href
      FROM _pages_v_blocks_form_embed WHERE _parent_id = 10
    `)).rows).toEqual([{
      fallback_contact_label: 'Message our welcome team',
      fallback_contact_href: '/contact',
    }])

    expect((await client.query(`
      SELECT campuses.slug, actions._order, actions.label, actions.href
      FROM campuses_page_content_actions actions
      JOIN campuses ON campuses.id = actions._parent_id
      ORDER BY campuses.slug, actions._order
    `)).rows).toEqual([
      { slug: 'central', _order: 2, label: 'Save service time', href: '/campus/central/calendar.ics' },
      { slug: 'north', _order: 1, label: 'Get directions', href: 'https://maps.example/north' },
      { slug: 'north', _order: 2, label: 'Save service time', href: '/campus/north/calendar.ics' },
    ])

    expect((await client.query(`
      SELECT slug, page_content_kids_ages
      FROM campuses
      ORDER BY slug
    `)).rows).toEqual([
      { slug: 'central', page_content_kids_ages: 'Available for ages 0 to 12' },
      { slug: 'elsewhere', page_content_kids_ages: 'Editor-selected ages' },
      { slug: 'north', page_content_kids_ages: 'Available for ages 0 to 12' },
    ])

    await client.query(PATH_TO_FIVE_FLEXIBLE_CONTENT_DOWN_SQL)

    expect((await client.query(`
      SELECT
        to_regclass('public.campuses_page_content_actions') AS actions,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'pages_blocks_form_embed' AND column_name = 'fallback_contact_label'
        ) AS fallback_exists,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'pages_blocks_manual_card_grid_cards' AND column_name = 'map_url'
        ) AS map_url_exists
    `)).rows[0]).toEqual({
      actions: null,
      fallback_exists: false,
      map_url_exists: false,
    })
  })
})
