import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  PROFILE_CARD_STYLE_DOWN_SQL,
  PROFILE_CARD_STYLE_UP_SQL,
} from '@/migrations/20260818_234000_profile_card_style'

const databaseUrl = process.env.PROFILE_CARD_STYLE_MIGRATION_TEST_DATABASE_URL
const describeIfDatabase = databaseUrl ? describe : describe.skip

function assertDisposableDatabase(url: string): void {
  const parsed = new URL(url)
  const isLocal = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'

  if (!isLocal || parsed.pathname !== '/profile_card_style_test') {
    throw new Error(
      'PROFILE_CARD_STYLE_MIGRATION_TEST_DATABASE_URL must target the local profile_card_style_test database',
    )
  }
}

async function enumValues(client: Client, name: string): Promise<string[]> {
  const result = await client.query<{ enumlabel: string }>(`
    SELECT enumlabel
    FROM pg_enum
    JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE pg_type.typname = $1
    ORDER BY enumsortorder
  `, [name])

  return result.rows.map((row) => row.enumlabel)
}

describeIfDatabase('profile card style migration', () => {
  let client: Client

  beforeAll(async () => {
    assertDisposableDatabase(databaseUrl!)
    client = new Client({ connectionString: databaseUrl })
    await client.connect()
  })

  beforeEach(async () => {
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    await client.query(`
      CREATE TYPE enum_pages_blocks_manual_card_grid_card_style
        AS ENUM ('info', 'imageOverlay', 'imageTop', 'alternatingRows');
      CREATE TYPE enum__pages_v_blocks_manual_card_grid_card_style
        AS ENUM ('info', 'imageOverlay', 'imageTop', 'alternatingRows');
      CREATE TABLE pages_blocks_manual_card_grid (
        id varchar PRIMARY KEY,
        card_style enum_pages_blocks_manual_card_grid_card_style DEFAULT 'info'
      );
      CREATE TABLE _pages_v_blocks_manual_card_grid (
        id serial PRIMARY KEY,
        card_style enum__pages_v_blocks_manual_card_grid_card_style DEFAULT 'info'
      );
      INSERT INTO pages_blocks_manual_card_grid (id, card_style) VALUES ('live', 'imageTop');
      INSERT INTO _pages_v_blocks_manual_card_grid (card_style) VALUES ('imageOverlay');
    `)
  })

  afterAll(async () => {
    if (client) {
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
      await client.end()
    }
  })

  it('adds and removes the profile value for live and versioned blocks', async () => {
    const original = ['info', 'imageOverlay', 'imageTop', 'alternatingRows']
    const expanded = ['info', 'imageOverlay', 'imageTop', 'profile', 'alternatingRows']

    await client.query(PROFILE_CARD_STYLE_UP_SQL)

    expect(await enumValues(client, 'enum_pages_blocks_manual_card_grid_card_style'))
      .toEqual(expanded)
    expect(await enumValues(client, 'enum__pages_v_blocks_manual_card_grid_card_style'))
      .toEqual(expanded)

    await client.query(PROFILE_CARD_STYLE_DOWN_SQL)

    expect(await enumValues(client, 'enum_pages_blocks_manual_card_grid_card_style'))
      .toEqual(original)
    expect(await enumValues(client, 'enum__pages_v_blocks_manual_card_grid_card_style'))
      .toEqual(original)

    const defaults = await client.query<{ column_default: string }>(`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('pages_blocks_manual_card_grid', '_pages_v_blocks_manual_card_grid')
        AND column_name = 'card_style'
      ORDER BY table_name
    `)
    expect(defaults.rows.every((row) => row.column_default.includes("'info'"))).toBe(true)

    await expect(client.query(PROFILE_CARD_STYLE_UP_SQL)).resolves.toBeDefined()
  })

  it.each([
    'pages_blocks_manual_card_grid',
    '_pages_v_blocks_manual_card_grid',
  ])('refuses rollback while %s uses the profile style', async (table) => {
    await client.query(PROFILE_CARD_STYLE_UP_SQL)
    await client.query(`UPDATE "${table}" SET card_style = 'profile'`)

    await expect(client.query(PROFILE_CARD_STYLE_DOWN_SQL)).rejects.toThrow(
      'Cannot remove the profile card style while page content uses it',
    )
    expect(await enumValues(client, 'enum_pages_blocks_manual_card_grid_card_style'))
      .toContain('profile')
    expect(await enumValues(client, 'enum__pages_v_blocks_manual_card_grid_card_style'))
      .toContain('profile')
  })
})
