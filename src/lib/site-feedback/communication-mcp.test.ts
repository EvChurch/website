import type { MCPAccessSettings } from '@payloadcms/plugin-mcp'
import type { PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'
import { feedbackCommunicationAuth, feedbackCommunicationTools } from './communication-mcp'
import type { User } from '@/payload-types'

describe('feedback communication MCP authorization', () => {
  it.each<[NonNullable<User['roles']>, boolean, boolean, boolean]>([
    [['admin'], true, true, true],
    [['content-lead'], true, true, true],
    [['editor'], true, true, false],
    [['admin'], true, false, false],
    [['admin'], false, true, false],
    [[], true, true, false],
  ])('requires a feedback read/write key and a content-lead/admin user: %j', async (roles, find, update, allowed) => {
    const req = { context: {} } as PayloadRequest
    const access: MCPAccessSettings = {
      user: { id: 1, name: 'Test', email: 'test@example.com', auth0IdentityKey: 'test',
        auth0Issuer: 'test', auth0Subject: 'test', roles, createdAt: '', updatedAt: '', collection: 'users' },
      feedbackSubmissions: { find, update },
    }
    expect(await feedbackCommunicationAuth(req, async () => access)).toBe(access)
    expect(req.context.canCommunicateFeedback).toBe(allowed)
  })
  it('rejects both tools before touching the database without the scoped MCP context', async () => {
    const req = { context: {}, user: { roles: ['admin'] } } as PayloadRequest
    for (const tool of feedbackCommunicationTools) {
      await expect(tool.handler({}, req, {})).rejects.toThrow('access denied')
    }
  })
})
