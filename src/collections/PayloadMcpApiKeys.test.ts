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
      'blinkpay-webhook-events', 'giving-checkouts', 'giving-consents', 'giving-drafts',
      'giving-e2e-runs', 'giving-funds', 'giving-gifts', 'giving-givers',
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
})
