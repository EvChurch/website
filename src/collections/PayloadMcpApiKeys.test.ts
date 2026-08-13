import { describe, expect, it } from 'vitest'

import { restrictMcpApiKeyCollection } from '../../payload.config'

const collection = restrictMcpApiKeyCollection({
  slug: 'payload-mcp-api-keys',
  fields: [],
})

describe('Payload MCP API key access', () => {
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
