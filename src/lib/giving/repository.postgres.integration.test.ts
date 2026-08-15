import { Client } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { GIVING_PILOT_UP_SQL } from '@/migrations/20260815_170000_giving_pilot'

const databaseUrl = process.env.GIVING_REPOSITORY_TEST_DATABASE_URL
function assertDisposable(value: string) {
  const url = new URL(value)
  if (!['localhost','127.0.0.1'].includes(url.hostname) || url.pathname !== '/giving_repository_test') throw new Error('GIVING_REPOSITORY_TEST_DATABASE_URL must target local database giving_repository_test')
}

describe.skipIf(!databaseUrl)('giving repository PostgreSQL invariants', () => {
  let client: Client
  beforeAll(async () => {
    assertDisposable(databaseUrl!); client = new Client({ connectionString: databaseUrl }); await client.connect()
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE TABLE users(id serial PRIMARY KEY); CREATE TABLE payload_locked_documents_rels(id serial PRIMARY KEY); INSERT INTO users DEFAULT VALUES;')
    await client.query(GIVING_PILOT_UP_SQL)
  })
  afterAll(async () => { await client?.end() })
  beforeEach(async () => { await client.query('DELETE FROM giving_funds') })

  it('rejects committing funds without an active default', async () => {
    await expect(client.query("INSERT INTO giving_funds(name,code,accounting_key) VALUES('Missions','MIS','missions')")).rejects.toThrow(/exactly one active default/)
  })

  it('atomically swaps the default within one transaction', async () => {
    await client.query("INSERT INTO giving_funds(name,code,accounting_key,is_default) VALUES('General','GEN','general',true)")
    await client.query('BEGIN')
    await client.query("UPDATE giving_funds SET is_default=false WHERE code='GEN'")
    await client.query("INSERT INTO giving_funds(name,code,accounting_key,is_default) VALUES('Missions','MIS','missions',true)")
    await client.query('COMMIT')
    expect((await client.query('SELECT code FROM giving_funds WHERE active AND is_default')).rows).toEqual([{ code: 'MIS' }])
  })
})
