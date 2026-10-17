import { describe, expect, it } from 'vitest'

import { canOperatePayloadJobs, isAdmin, isContentLead, isEditor, publishedOnly } from './roles'

function args(roles?: string[]) {
  return { req: { user: roles === undefined ? null : { roles } } } as never
}

describe('Payload role access', () => {
  it('does not treat a roleless authenticated user as an editor', () => {
    expect(isEditor(args([]))).toBe(false)
    expect(publishedOnly(args([]))).toEqual({ _status: { equals: 'published' } })
  })

  it('preserves the configured role hierarchy', () => {
    expect(isAdmin(args(['admin']))).toBe(true)
    expect(isContentLead(args(['admin']))).toBe(true)
    expect(isContentLead(args(['content-lead']))).toBe(true)
    expect(isEditor(args(['content-lead']))).toBe(true)
    expect(isEditor(args(['editor']))).toBe(true)
  })

  it('rejects absent and unknown roles', () => {
    expect(isEditor(args())).toBe(false)
    expect(isEditor(args(['member']))).toBe(false)
  })
})

it('excludes finance-only Payload users from CMS job operations', () => {
  expect(canOperatePayloadJobs({ req: { user: { collection: 'users', roles: [] } } })).toBe(false)
  expect(canOperatePayloadJobs({ req: { user: { collection: 'users', roles: ['editor'] } } })).toBe(true)
  expect(canOperatePayloadJobs({ req: { user: { collection: 'payload-mcp-api-keys' } } })).toBe(true)
  expect(canOperatePayloadJobs({ req: { user: null } })).toBe(false)
})
