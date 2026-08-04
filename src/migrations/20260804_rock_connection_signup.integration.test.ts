import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { NEWISH_CONNECTION_BLOCK_GUID } from '@/seed/newish-form'
import {
  ROCK_CONNECTION_SIGNUP_DOWN_SQL,
  ROCK_CONNECTION_SIGNUP_UP_SQL,
} from './20260804_rock_connection_signup'

const databaseUrl = process.env.ROCK_MIGRATION_TEST_DATABASE_URL
const oldWorkflowGuid = '00778880-81fe-4871-aa91-7c81783b8c4d'

function assertDisposableDatabase(value: string): void {
  const url = new URL(value)
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.pathname !== '/rock_connection_signup_test'
  ) {
    throw new Error(
      'ROCK_MIGRATION_TEST_DATABASE_URL must target local database rock_connection_signup_test',
    )
  }
}

describe.skipIf(!databaseUrl)(
  'Rock connection signup migration on PostgreSQL',
  () => {
    let client: Client

    beforeAll(async () => {
      assertDisposableDatabase(databaseUrl as string)
      client = new Client({ connectionString: databaseUrl })
      await client.connect()
    })

    afterAll(async () => {
      await client?.end()
    })

    async function resetFixture({ mismatched = false } = {}): Promise<void> {
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
      await client.query(`
      CREATE TABLE pages (id integer PRIMARY KEY, slug text NOT NULL);
      CREATE TABLE _pages_v (
        id integer PRIMARY KEY,
        parent_id integer NOT NULL,
        version_slug text NOT NULL,
        latest boolean NOT NULL
      );
      CREATE TABLE pages_blocks_form_embed (
        id integer PRIMARY KEY,
        _parent_id integer NOT NULL,
        _path text NOT NULL,
        _order integer NOT NULL,
        layout text,
        rock_workflow_guid varchar
      );
      CREATE TABLE _pages_v_blocks_form_embed (
        id integer PRIMARY KEY,
        _parent_id integer NOT NULL,
        _path text NOT NULL,
        _order integer NOT NULL,
        layout text,
        rock_workflow_guid varchar
      );
      INSERT INTO pages VALUES (1, 'newish'), (2, 'contact');
      INSERT INTO _pages_v VALUES (10, 1, 'newish', true), (11, 1, 'newish', false);
      INSERT INTO pages_blocks_form_embed VALUES
        (100, 1, 'layout', ${mismatched ? 4 : 5}, 'centered', '${oldWorkflowGuid}'),
        (101, 2, 'layout', 1, 'centered', '11111111-1111-4111-8111-111111111111');
      INSERT INTO _pages_v_blocks_form_embed VALUES
        (200, 10, 'version.layout', 5, 'centered', '${oldWorkflowGuid}'),
        (201, 11, 'version.layout', 5, 'centered', '${oldWorkflowGuid}');
    `)
    }

    it('converts only reviewed Newish rows and enforces source identity', async () => {
      await resetFixture()
      await client.query('BEGIN')
      await client.query(ROCK_CONNECTION_SIGNUP_UP_SQL)
      await client.query('COMMIT')

      const live = await client.query(`
      SELECT id, source_type::text, rock_workflow_guid, rock_connection_block_guid
      FROM pages_blocks_form_embed ORDER BY id
    `)
      expect(live.rows).toEqual([
        {
          id: 100,
          source_type: 'connectionOpportunity',
          rock_workflow_guid: null,
          rock_connection_block_guid: NEWISH_CONNECTION_BLOCK_GUID,
        },
        {
          id: 101,
          source_type: 'workflow',
          rock_workflow_guid: '11111111-1111-4111-8111-111111111111',
          rock_connection_block_guid: null,
        },
      ])
      const versions = await client.query(`
      SELECT count(*)::integer AS count
      FROM _pages_v_blocks_form_embed
      WHERE source_type::text = 'connectionOpportunity'
        AND rock_workflow_guid IS NULL
        AND rock_connection_block_guid = '${NEWISH_CONNECTION_BLOCK_GUID}'
    `)
      expect(versions.rows[0].count).toBe(2)
      await expect(
        client.query(`
      INSERT INTO pages_blocks_form_embed
        (id, _parent_id, _path, _order, layout, source_type, rock_workflow_guid, rock_connection_block_guid)
      VALUES
        (102, 2, 'layout', 2, 'centered', 'workflow', '${oldWorkflowGuid}', '${NEWISH_CONNECTION_BLOCK_GUID}')
    `),
      ).rejects.toMatchObject({ code: '23514' })
    })

    it('rolls back the whole migration when the candidate manifest is unsafe', async () => {
      await resetFixture({ mismatched: true })
      await client.query('BEGIN')
      await expect(client.query(ROCK_CONNECTION_SIGNUP_UP_SQL)).rejects.toThrow(
        'Unsafe live Newish form candidate set',
      )
      await client.query('ROLLBACK')

      const columns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'pages_blocks_form_embed'
        AND column_name = 'source_type'
    `)
      expect(columns.rowCount).toBe(0)
    })

    it('refuses down while Connection rows exist without changing the schema', async () => {
      await resetFixture()
      await client.query(ROCK_CONNECTION_SIGNUP_UP_SQL)

      await expect(
        client.query(ROCK_CONNECTION_SIGNUP_DOWN_SQL),
      ).rejects.toThrow('Cannot roll back Rock Connection Signup')

      const columns = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pages_blocks_form_embed'
          AND column_name = 'source_type'
      `)
      expect(columns.rowCount).toBe(1)
    })

    it('executes a workflow-only down and re-applies the migration', async () => {
      await resetFixture()
      await client.query(ROCK_CONNECTION_SIGNUP_UP_SQL)
      await client.query(`
        UPDATE pages_blocks_form_embed
        SET source_type = 'workflow',
            rock_workflow_guid = '${oldWorkflowGuid}',
            rock_connection_block_guid = NULL
        WHERE source_type::text = 'connectionOpportunity';
        UPDATE _pages_v_blocks_form_embed
        SET source_type = 'workflow',
            rock_workflow_guid = '${oldWorkflowGuid}',
            rock_connection_block_guid = NULL
        WHERE source_type::text = 'connectionOpportunity';
      `)

      await client.query(ROCK_CONNECTION_SIGNUP_DOWN_SQL)
      const removedColumns = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pages_blocks_form_embed'
          AND column_name = 'source_type'
      `)
      expect(removedColumns.rowCount).toBe(0)

      await client.query(ROCK_CONNECTION_SIGNUP_UP_SQL)
      const reapplied = await client.query(`
        SELECT count(*)::integer AS count
        FROM pages_blocks_form_embed
        WHERE source_type::text = 'connectionOpportunity'
      `)
      expect(reapplied.rows[0].count).toBe(1)
    })
  },
)
