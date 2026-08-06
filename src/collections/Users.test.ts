import { describe, expect, it } from 'vitest'

import { Users } from './Users'

function accessArgs(roles: string[] | null) {
  return { req: { user: roles === null ? null : { roles } } } as never
}

describe('Users authentication boundary', () => {
  it('uses only the Auth0 strategy and creates users without a default role', () => {
    expect(Users.auth).not.toBe(true)
    expect(Users.auth).toMatchObject({ disableLocalStrategy: true })

    const roles = Users.fields.find(
      (field) => 'name' in field && field.name === 'roles',
    )
    expect(roles).toMatchObject({ required: false })
    expect(roles).not.toHaveProperty('defaultValue')
  })

  it('hides roleless users from the admin panel', () => {
    const hidden = Users.admin?.hidden
    expect(typeof hidden).toBe('function')
    expect((hidden as (args: unknown) => boolean)({ user: { roles: [] } })).toBe(true)
    expect(
      (hidden as (args: unknown) => boolean)({ user: { roles: ['editor'] } }),
    ).toBe(false)
  })

  it('allows only administrators to manage users and roles', async () => {
    const access = Users.access
    const roles = Users.fields.find(
      (field) => 'name' in field && field.name === 'roles',
    )
    if (!access || !roles || !('access' in roles) || !roles.access?.update) {
      throw new Error('Users access rules are not configured')
    }

    const create = access.create
    expect(typeof create).toBe('function')
    if (typeof create === 'function') {
      expect(await create(accessArgs(['admin']))).toBe(false)
      expect(await create(accessArgs(null))).toBe(false)
    }

    for (const operation of ['read', 'update', 'delete'] as const) {
      const rule = access[operation]
      expect(typeof rule).toBe('function')
      if (typeof rule !== 'function') continue
      expect(await rule(accessArgs(['admin']))).toBe(true)
      expect(await rule(accessArgs(['editor']))).toBe(false)
      expect(await rule(accessArgs([]))).toBe(false)
      expect(await rule(accessArgs(null))).toBe(false)
    }

    expect(
      await roles.access.update(accessArgs(['admin'])),
    ).toBe(true)
    expect(
      await roles.access.update(accessArgs(['editor'])),
    ).toBe(false)
  })
})
