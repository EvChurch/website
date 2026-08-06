import { describe, expect, it } from 'vitest'

import { isAdmin, isContentLead, isEditor, publishedOnly } from './roles'

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
