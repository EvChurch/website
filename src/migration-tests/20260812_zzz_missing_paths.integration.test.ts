import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'

import config from '../../payload.config'
import {
  down as missingPathsDown,
  up as missingPathsUp,
} from '../migrations/20260812_zzz_missing_paths'
import { migrations } from '../migrations'

const databaseUrl = process.env.MISSING_PATHS_MIGRATION_TEST_DATABASE_URL

function assertDisposableDatabase(value: string): void {
  const url = new URL(value)
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.pathname !== '/church_web_migration'
  ) {
    throw new Error(
      'MISSING_PATHS_MIGRATION_TEST_DATABASE_URL must target local database church_web_migration',
    )
  }
}

describe.skipIf(!databaseUrl)('MissingPaths migration on PostgreSQL', () => {
  let payload: Payload

  beforeAll(async () => {
    assertDisposableDatabase(databaseUrl as string)
    process.env.PAYLOAD_MIGRATING = 'true'
    const payloadModule = await import('payload')
    payload = await payloadModule.getPayload({ config })
  }, 120_000)

  afterAll(async () => {
    await payload?.destroy()
  })

  it('migrates up, supports Payload Local API CRUD, rolls down, and reapplies', async () => {
    const missingPathsIndex = migrations.findIndex(
      ({ name }) => name === '20260812_zzz_missing_paths',
    )
    expect(missingPathsIndex).toBeGreaterThan(-1)

    for (const migration of migrations.slice(0, missingPathsIndex)) {
      await migration.up({
        db: { execute: (statement: unknown) => payload.db.drizzle.execute(statement as never) },
        payload,
        req: {},
      } as never)
    }
    const migrationDb = { execute: (statement: unknown) => payload.db.drizzle.execute(statement as never) }
    await missingPathsUp({ db: migrationDb, payload, req: {} } as never)

    const created = await payload.create({
      collection: 'missing-paths',
      data: {
        path: '/migration-smoke',
        count: 2,
        destination: '/about',
      },
      overrideAccess: true,
    })
    const read = await payload.findByID({
      collection: 'missing-paths',
      id: created.id,
      overrideAccess: true,
    })
    expect(read).toMatchObject({
      path: '/migration-smoke',
      count: 2,
      destination: '/about',
    })

    const updated = await payload.update({
      collection: 'missing-paths',
      id: created.id,
      data: { count: 3 },
      overrideAccess: true,
    })
    expect(updated.count).toBe(3)

    await payload.delete({
      collection: 'missing-paths',
      id: created.id,
      overrideAccess: true,
    })
    const afterDelete = await payload.find({
      collection: 'missing-paths',
      overrideAccess: true,
      where: { path: { equals: '/migration-smoke' } },
    })
    expect(afterDelete.totalDocs).toBe(0)

    const firstRedirect = await payload.create({
      collection: 'missing-paths',
      data: {
        path: '/migration-chain-old',
        count: 1,
        destination: '/migration-chain-middle',
      },
      overrideAccess: true,
    })
    await expect(payload.create({
      collection: 'missing-paths',
      data: {
        path: '/migration-chain-middle',
        count: 1,
        destination: '/migration-chain-new',
      },
      overrideAccess: true,
    })).rejects.toMatchObject({ status: 400 })
    await payload.delete({
      collection: 'missing-paths',
      id: firstRedirect.id,
      overrideAccess: true,
    })

    const args = { db: migrationDb, payload, req: {} } as never
    await missingPathsDown(args)
    const rolledDown = await payload.db.drizzle.execute(
      'SELECT to_regclass(\'public.missing_paths\')::text AS table_name',
    )
    expect(rolledDown.rows[0]?.table_name).toBeNull()

    await missingPathsUp(args)
    const reapplied = await payload.db.drizzle.execute(
      'SELECT to_regclass(\'public.missing_paths\')::text AS table_name',
    )
    expect(reapplied.rows[0]?.table_name).toBe('missing_paths')

    await missingPathsDown(args)
    const rolledDownAgain = await payload.db.drizzle.execute(
      'SELECT to_regclass(\'public.missing_paths\')::text AS table_name',
    )
    expect(rolledDownAgain.rows[0]?.table_name).toBeNull()

    await missingPathsUp(args)
    const reappliedAgain = await payload.db.drizzle.execute(
      'SELECT to_regclass(\'public.missing_paths\')::text AS table_name',
    )
    expect(reappliedAgain.rows[0]?.table_name).toBe('missing_paths')
  }, 120_000)
})
