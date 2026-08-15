import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { GIVING_DRAFTS_UP_SQL } from '../migrations/20260815_210000_giving_drafts'

const databaseUrl = process.env.GIVING_MIGRATION_TEST_DATABASE_URL

function assertDisposableDatabase(value: string) {
  const url = new URL(value)
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/giving_pilot_test') {
    throw new Error('GIVING_MIGRATION_TEST_DATABASE_URL must target local database giving_pilot_test')
  }
}

describe.skipIf(!databaseUrl)('giving draft capability redemption on PostgreSQL', () => {
  let first: Client
  let second: Client

  beforeAll(async () => {
    assertDisposableDatabase(databaseUrl!)
    first = new Client({ connectionString: databaseUrl })
    second = new Client({ connectionString: databaseUrl })
    await Promise.all([first.connect(), second.connect()])
    await first.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE TABLE payload_locked_documents_rels(id serial PRIMARY KEY);')
    await first.query(GIVING_DRAFTS_UP_SQL)
  })

  afterAll(async () => {
    await Promise.all([first?.end(), second?.end()])
  })

  it('allows exactly one concurrent single-use redemption', async () => {
    await first.query('DELETE FROM giving_drafts')
    await first.query(`INSERT INTO giving_drafts
      (token_digest,binding_digest,purpose,audience,answers,expires_at)
      VALUES ($1,$2,'giving-draft-resume-v1','guest',$3,now()+interval '15 minutes')`, [
      'token-digest',
      'binding-digest',
      JSON.stringify({ amountMinor: 5000 }),
    ])
    const redeem = (client: Client) => client.query(`UPDATE giving_drafts
      SET consumed_at=now(),updated_at=now()
      WHERE token_digest=$1 AND binding_digest=$2
        AND purpose='giving-draft-resume-v1' AND audience='guest'
        AND consumed_at IS NULL AND expires_at > now()
      RETURNING id`, ['token-digest', 'binding-digest'])

    const results = await Promise.all([redeem(first), redeem(second)])
    expect(results.map(({ rowCount }) => rowCount).sort()).toEqual([0, 1])
    expect((await first.query('SELECT count(*)::int AS count FROM giving_drafts WHERE consumed_at IS NOT NULL')).rows[0].count).toBe(1)
  })
})
