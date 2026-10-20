import { Client } from 'pg'
import { PgDialect } from '@payloadcms/db-postgres/drizzle/pg-core'
import type { SQL } from '@payloadcms/db-postgres/drizzle'
import { describe, expect, it } from 'vitest'
import { up, down } from '@/migrations/20261021_010000_event_scheduled_occurrences'

const localTest = process.env.ISSUE394_LOCAL_MIGRATION_TEST === '1' ? describe : describe.skip

localTest('event schedule migration on an isolated local database', () => {
  it('adds the field twice without changing event timing or registration, and preserves dates on rollback', async () => {
    const client = new Client({ host: '/var/run/postgresql', database: 'issue394_build_20261021', user: 'tataihono' })
    await client.connect()
    try {
      const target = await client.query('SELECT current_database() AS name, inet_server_addr() IS NULL AS local')
      expect(target.rows[0]).toEqual({ name: 'issue394_build_20261021', local: true })
      await client.query('BEGIN')
      await client.query('CREATE SCHEMA issue394_migration_check; SET LOCAL search_path TO issue394_migration_check')
      await client.query(`CREATE TABLE events (id integer PRIMARY KEY, start_date text, end_date text, registration_url text);
        INSERT INTO events VALUES (1, 'start', 'end', 'registration')`)
      const dialect = new PgDialect()
      const args = { db: { execute: (statement: SQL) => {
        const query = dialect.sqlToQuery(statement)
        return client.query(query.sql, query.params)
      } } } as unknown as Parameters<typeof up>[0]
      await up(args)
      await up(args)
      const schedule = [{ startDate: '2027-01-18T19:45:00.000Z', endDate: '2027-01-19T02:00:00.000Z' }]
      await client.query('UPDATE events SET scheduled_occurrences=$1::jsonb WHERE id=1', [JSON.stringify(schedule)])
      await down(args)
      expect((await client.query('SELECT * FROM events')).rows).toEqual([{
        id: 1, start_date: 'start', end_date: 'end', registration_url: 'registration', scheduled_occurrences: schedule,
      }])
    } finally {
      await client.query('ROLLBACK')
      await client.end()
    }
  })
})
