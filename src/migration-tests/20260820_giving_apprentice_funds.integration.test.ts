import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  GIVING_APPRENTICE_FUNDS_DOWN_SQL,
  GIVING_APPRENTICE_FUNDS_UP_SQL,
} from '../migrations/20260820_180000_giving_apprentice_funds'

const databaseUrl = process.env.GIVING_MIGRATION_TEST_DATABASE_URL

function assertDisposableDatabase(value: string) {
  const url = new URL(value)
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/giving_pilot_test') {
    throw new Error('GIVING_MIGRATION_TEST_DATABASE_URL must target local database giving_pilot_test')
  }
}

describe.skipIf(!databaseUrl)('giving apprentice funds migration on PostgreSQL', () => {
  let client: Client

  beforeAll(async () => {
    assertDisposableDatabase(databaseUrl!)
    client = new Client({ connectionString: databaseUrl })
    await client.connect()
  })

  afterAll(async () => client?.end())

  beforeEach(async () => {
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    await client.query('CREATE TABLE giving_funds (id serial PRIMARY KEY, name varchar NOT NULL);')
    await client.query("INSERT INTO giving_funds(name) VALUES('General');")
  })

  it('keeps existing funds normal, stores apprentice tagging and rolls back cleanly', async () => {
    await client.query(GIVING_APPRENTICE_FUNDS_UP_SQL)

    expect((await client.query('SELECT name, apprentice_related FROM giving_funds')).rows).toEqual([
      { name: 'General', apprentice_related: false },
    ])
    await client.query("UPDATE giving_funds SET apprentice_related=true WHERE name='General'")
    expect((await client.query('SELECT apprentice_related FROM giving_funds')).rows[0].apprentice_related).toBe(true)
    expect((await client.query("SELECT to_regclass('giving_funds_apprentice_related_idx') name")).rows[0].name).toBe('giving_funds_apprentice_related_idx')

    await client.query(GIVING_APPRENTICE_FUNDS_DOWN_SQL)

    expect((await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='giving_funds' AND column_name='apprentice_related'")).rows).toEqual([])
  })
})
