import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GIVING_PILOT_DOWN_SQL, GIVING_PILOT_UP_SQL } from '../migrations/20260815_170000_giving_pilot'

const databaseUrl = process.env.GIVING_MIGRATION_TEST_DATABASE_URL
function assertDisposableDatabase(value: string) {
  const url = new URL(value)
  if (!['127.0.0.1','localhost'].includes(url.hostname) || url.pathname !== '/giving_pilot_test') throw new Error('GIVING_MIGRATION_TEST_DATABASE_URL must target local database giving_pilot_test')
}

describe.skipIf(!databaseUrl)('giving pilot migration on PostgreSQL', () => {
  let client: Client
  beforeAll(async () => { assertDisposableDatabase(databaseUrl!); client = new Client({ connectionString: databaseUrl }); await client.connect() })
  afterAll(async () => { await client?.end() })
  async function reset() {
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE TABLE users(id serial PRIMARY KEY); CREATE TABLE payload_locked_documents_rels(id serial PRIMARY KEY); INSERT INTO users DEFAULT VALUES;')
  }
  it('enforces context, amount and environment-scoped provider identifiers', async () => {
    await reset(); await client.query(GIVING_PILOT_UP_SQL)
    await client.query("INSERT INTO giving_e2e_runs(run_id,context_key,actor_id,token_digest,expires_at) VALUES('r','sandbox:e2e:r',1,'digest',now()+interval '1 hour')")
    await expect(client.query("INSERT INTO giving_givers(context_key,environment,synthetic,rock_person_alias_id,bank_reference,name,email) VALUES('production','production',true,1,'EV1','A','a@example.com')")).rejects.toMatchObject({ code: '23514' })
    await expect(client.query("INSERT INTO giving_givers(context_key,environment,synthetic,e2e_run_id,rock_person_alias_id,bank_reference,name,email) VALUES('sandbox:e2e:r','sandbox',true,1,1,'EV1','A','a@example.com')")).resolves.toBeDefined()
  })
  it('rolls down empty and refuses atomically after any giving write', async () => {
    await reset(); await client.query(GIVING_PILOT_UP_SQL); await client.query(GIVING_PILOT_DOWN_SQL)
    await client.query(GIVING_PILOT_UP_SQL); await client.query("INSERT INTO giving_funds(name,code,accounting_key,is_default) VALUES('Missions','MIS','acct',true)")
    await expect(client.query(GIVING_PILOT_DOWN_SQL)).rejects.toThrow(/Cannot roll back giving pilot/)
    expect((await client.query("SELECT to_regclass('giving_funds')::text AS name")).rows[0].name).toBe('giving_funds')
  })
})
