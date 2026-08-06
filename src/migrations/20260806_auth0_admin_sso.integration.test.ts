import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  AUTH0_ADMIN_SSO_DOWN_SQL,
  AUTH0_ADMIN_SSO_UP_SQL,
} from './20260806_auth0_admin_sso'

const databaseUrl = process.env.AUTH0_MIGRATION_TEST_DATABASE_URL

function assertDisposableDatabase(value: string): void {
  const url = new URL(value)
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.pathname !== '/auth0_admin_sso_test'
  ) {
    throw new Error(
      'AUTH0_MIGRATION_TEST_DATABASE_URL must target local database auth0_admin_sso_test',
    )
  }
}

describe.skipIf(!databaseUrl)('Auth0 admin SSO migration on PostgreSQL', () => {
  let client: Client

  beforeAll(async () => {
    assertDisposableDatabase(databaseUrl as string)
    client = new Client({ connectionString: databaseUrl })
    await client.connect()
  })

  afterAll(async () => {
    await client?.end()
  })

  async function resetFixture(): Promise<void> {
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    await client.query(`
      CREATE TABLE users (
        id serial PRIMARY KEY,
        name varchar NOT NULL,
        email varchar NOT NULL UNIQUE,
        reset_password_token varchar,
        reset_password_expiration timestamp(3) with time zone,
        salt varchar,
        hash varchar,
        login_attempts numeric DEFAULT 0,
        lock_until timestamp(3) with time zone
      );
      CREATE TABLE users_roles (
        _order integer NOT NULL,
        parent_id integer NOT NULL REFERENCES users(id) ON DELETE cascade,
        value varchar
      );
      CREATE TABLE users_sessions (
        _order integer NOT NULL,
        _parent_id integer NOT NULL REFERENCES users(id) ON DELETE cascade,
        id varchar PRIMARY KEY NOT NULL,
        created_at timestamp(3) with time zone,
        expires_at timestamp(3) with time zone NOT NULL
      );
    `)
  }

  async function columnNames(): Promise<string[]> {
    const result = await client.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY column_name
    `)
    return result.rows.map(({ column_name }) => column_name)
  }

  it('refuses existing users and rolls back every schema change', async () => {
    await resetFixture()
    await client.query(
      `INSERT INTO users (name, email) VALUES ('Dev User', 'dev@example.com')`,
    )
    await client.query('BEGIN')
    await expect(client.query(AUTH0_ADMIN_SSO_UP_SQL)).rejects.toThrow(
      'requires zero existing Payload users',
    )
    await client.query('ROLLBACK')
    expect(await columnNames()).not.toContain('auth0_identity_key')
    const sessions = await client.query(`SELECT to_regclass('public.users_sessions') AS name`)
    expect(sessions.rows[0].name).toBe('users_sessions')
  })

  it('rolls back schema changes when a later DDL statement fails', async () => {
    await resetFixture()
    await client.query(
      'CREATE INDEX users_auth0_identity_key_idx ON users USING btree (email)',
    )
    await client.query('BEGIN')
    await expect(client.query(AUTH0_ADMIN_SSO_UP_SQL)).rejects.toThrow(
      'users_auth0_identity_key_idx',
    )
    await client.query('ROLLBACK')
    expect(await columnNames()).not.toContain('auth0_identity_key')
    const sessions = await client.query(`SELECT to_regclass('public.users_sessions') AS name`)
    expect(sessions.rows[0].name).toBe('users_sessions')
  })

  it('migrates empty schema, refuses unsafe down, then rolls down and reapplies', async () => {
    await resetFixture()
    await client.query(AUTH0_ADMIN_SSO_UP_SQL)
    expect(await columnNames()).toEqual(
      expect.arrayContaining(['auth0_identity_key', 'auth0_issuer', 'auth0_subject']),
    )
    expect(await columnNames()).not.toContain('hash')
    const removedSessions = await client.query(
      `SELECT to_regclass('public.users_sessions') AS name`,
    )
    expect(removedSessions.rows[0].name).toBeNull()

    await client.query(`
      INSERT INTO users (name, email, auth0_identity_key, auth0_issuer, auth0_subject)
      VALUES ('Auth0 User', 'auth0@example.com', 'identity', 'https://issuer/', 'auth0|1')
    `)
    await client.query('BEGIN')
    await expect(client.query(AUTH0_ADMIN_SSO_DOWN_SQL)).rejects.toThrow(
      'Cannot restore local authentication while Auth0 users exist',
    )
    await client.query('ROLLBACK')
    expect(await columnNames()).toContain('auth0_identity_key')

    await client.query('DELETE FROM users')
    await client.query(AUTH0_ADMIN_SSO_DOWN_SQL)
    expect(await columnNames()).toContain('hash')
    expect(await columnNames()).not.toContain('auth0_identity_key')
    await client.query(AUTH0_ADMIN_SSO_UP_SQL)
    expect(await columnNames()).toContain('auth0_identity_key')
  })
})
