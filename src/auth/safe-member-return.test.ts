import { describe, expect, it } from 'vitest'

import { safeMemberReturnTo } from './safe-member-return'

describe('safe member return destinations', () => {
  it('keeps public paths and query strings', () => {
    expect(safeMemberReturnTo('/events?campus=East')).toBe('/events?campus=East')
  })

  it.each([
    'events',
    'https://evil.example/events',
    '//evil.example/events',
    '/\\evil.example/events',
    '/admin',
    '/admin/pages',
    '/api/users',
    '/auth/login',
    '/member-auth/complete',
    '/events/%2f%2fevil.example',
    '/give',
    '/give/return/token',
    '/give/resume/abcdefghijklmnopqrstuvwxyz0123456789_ABCDEF',
  ])('rejects %s', (value) => {
    expect(safeMemberReturnTo(value)).toBe('/')
  })
})
