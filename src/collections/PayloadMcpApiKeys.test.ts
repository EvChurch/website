import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  applicationCollections,
  applicationGlobals,
  mcpCollections,
  mcpExcludedCollectionSlugs,
  mcpGlobals,
  restrictMcpApiKeyCollection,
} from '../../payload.config'

const collection = restrictMcpApiKeyCollection({
  slug: 'payload-mcp-api-keys',
  fields: [],
})

const migrationModules = import.meta.glob('../migrations/*.ts', {
  eager: true,
}) as Record<string, Record<string, unknown>>

const migrationIndex = readFileSync(
  new URL('../migrations/index.ts', import.meta.url),
  'utf8',
)

const migratedMcpSchema = Object.entries(migrationModules)
  .filter(([path]) => {
    const migrationName = path.split('/').at(-1)?.replace(/\.ts$/, '')
    return migrationName && migrationIndex.includes(`name: '${migrationName}'`)
  })
  .map(([, migration]) => migration)
  .flatMap((migration) => Object.entries(migration))
  .filter(
    (entry): entry is [string, string] =>
      entry[0].endsWith('_UP_SQL') && typeof entry[1] === 'string',
  )
  .map(([, sql]) => sql)
  .join('\n')

describe('Payload MCP API key access', () => {
  it('exposes application content but excludes the capability-token store', () => {
    expect(Object.keys(mcpCollections).sort()).toEqual(
      applicationCollections
        .map(({ slug }) => slug)
        .filter((slug) => !mcpExcludedCollectionSlugs.has(slug))
        .sort(),
    )
    expect(mcpCollections).not.toHaveProperty('leader-resource-shares')
    expect([...mcpExcludedCollectionSlugs].sort()).toEqual([
      'blinkpay-webhook-events', 'connect-group-comments', 'giving-checkouts', 'giving-consents', 'giving-drafts',
      'giving-funds', 'giving-gifts', 'giving-givers',
      'giving-provider-operations', 'giving-schedules', 'leader-resource-shares',
    ])
    for (const slug of mcpExcludedCollectionSlugs) {
      expect(mcpCollections).not.toHaveProperty(slug)
    }
    expect(Object.keys(mcpGlobals).sort()).toEqual(
      applicationGlobals.map(({ slug }) => slug).sort(),
    )
    expect(Object.values(mcpCollections).every(({ enabled }) => enabled === true)).toBe(true)
    expect(Object.values(mcpGlobals).every(({ enabled }) => enabled === true)).toBe(true)
  })

  it('allows only administrators to manage MCP credentials', () => {
    const access = collection.access
    const admin = { roles: ['admin'] }
    const editor = { roles: ['editor'] }

    for (const operation of ['create', 'read', 'update', 'delete'] as const) {
      expect(access?.[operation]?.({ req: { user: admin } } as never)).toBe(true)
      expect(access?.[operation]?.({ req: { user: editor } } as never)).toBe(false)
      expect(access?.[operation]?.({ req: { user: null } } as never)).toBe(false)
    }
  })

  it('has migrated permission columns for every exposed MCP entity', () => {
    const expectedPermissions = [
      ...Object.keys(mcpCollections).flatMap((slug) =>
        ['find', 'create', 'update', 'delete'].map(
          (operation) => `${slug.replaceAll('-', '_')}_${operation}`,
        ),
      ),
      ...Object.keys(mcpGlobals).flatMap((slug) =>
        ['find', 'update'].map(
          (operation) => `${slug.replaceAll('-', '_')}_${operation}`,
        ),
      ),
    ]

    for (const permission of expectedPermissions) {
      expect(migratedMcpSchema, `missing migration for ${permission}`).toContain(
        `"${permission}" boolean`,
      )
    }
  })
})
