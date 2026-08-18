import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_DOWN_SQL,
  FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_UP_SQL,
} from '../migrations/20260819_030000_fix_connect_group_comments_lock_relation'

const databaseUrl = process.env.CONNECT_GROUP_COMMENTS_MIGRATION_TEST_DATABASE_URL

function assertDisposableDatabase(value: string): void {
  const url = new URL(value)
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.pathname !== '/connect_group_comments_migration_test'
  ) {
    throw new Error(
      'CONNECT_GROUP_COMMENTS_MIGRATION_TEST_DATABASE_URL must target local database connect_group_comments_migration_test',
    )
  }
}

describe.skipIf(!databaseUrl)(
  'Connect Group comments lock relation migration on PostgreSQL',
  () => {
    let client: Client

    beforeAll(async () => {
      assertDisposableDatabase(databaseUrl as string)
      client = new Client({ connectionString: databaseUrl })
      await client.connect()
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
      await client.query(`
        CREATE TABLE connect_group_comments (id serial PRIMARY KEY);
        CREATE TABLE payload_locked_documents_rels (
          id serial PRIMARY KEY,
          parent_id integer NOT NULL
        );
      `)
    })

    afterAll(async () => {
      await client?.end()
    })

    async function runInTransaction(statement: string): Promise<void> {
      await client.query('BEGIN')
      try {
        await client.query(statement)
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }

    it('applies twice safely and creates the expected column, foreign key, and index', async () => {
      await runInTransaction(FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_UP_SQL)
      await runInTransaction(FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_UP_SQL)

      const column = await client.query(`
        SELECT data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payload_locked_documents_rels'
          AND column_name = 'connect_group_comments_id'
      `)
      expect(column.rows).toEqual([{ data_type: 'integer', is_nullable: 'YES' }])

      const foreignKey = await client.query(`
        SELECT pg_get_constraintdef(oid) AS definition
        FROM pg_constraint
        WHERE conname = 'payload_locked_documents_rels_connect_group_comments_fk'
      `)
      expect(foreignKey.rows).toEqual([
        {
          definition:
            'FOREIGN KEY (connect_group_comments_id) REFERENCES connect_group_comments(id) ON DELETE CASCADE',
        },
      ])

      const index = await client.query(`
        SELECT indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'payload_locked_documents_rels_connect_group_comments_id_idx'
      `)
      expect(index.rows).toHaveLength(1)
      expect(index.rows[0]?.indexdef).toContain('(connect_group_comments_id)')
    })

    it('rolls back only the corrective relationship objects', async () => {
      await runInTransaction(FIX_CONNECT_GROUP_COMMENTS_LOCK_RELATION_DOWN_SQL)

      const state = await client.query(`
        SELECT
          to_regclass('public.connect_group_comments')::text AS comments_table,
          to_regclass('public.payload_locked_documents_rels')::text AS locks_table,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'payload_locked_documents_rels'
              AND column_name = 'connect_group_comments_id'
          ) AS relation_column_exists
      `)
      expect(state.rows).toEqual([
        {
          comments_table: 'connect_group_comments',
          locks_table: 'payload_locked_documents_rels',
          relation_column_exists: false,
        },
      ])
    })
  },
)
