import { describe, expect, it } from 'vitest'

import { safeAdminReturnTo } from './safe-admin-return'

describe('safe admin return destinations', () => {
  it('keeps admin paths and query strings', () => {
    expect(safeAdminReturnTo('/admin/collections/pages?limit=10')).toBe(
      '/admin/collections/pages?limit=10',
    )
  })

  it.each([
    'https://evil.example/admin',
    '//evil.example/admin',
    '/\\evil.example/admin',
    '/members',
    '/auth/callback',
    '/administer',
    '/admin/%2f%2fevil.example',
  ])('rejects %s', (value) => {
    expect(safeAdminReturnTo(value)).toBe('/admin')
  })
})
