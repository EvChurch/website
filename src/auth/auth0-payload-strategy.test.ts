import { describe, expect, it, vi } from 'vitest'

import { authenticateAuth0PayloadUser } from './auth0-payload-strategy'

const identity = {
  identityKey: 'key',
  issuer: 'https://tenant.example/',
  subject: 'auth0|123',
  email: 'staff@ev.church',
  name: 'Staff',
}

describe('Payload Auth0 strategy', () => {
  it('does not query Payload without a valid Auth0 session', async () => {
    const resolve = vi.fn()
    const result = await authenticateAuth0PayloadUser(new Headers(), {} as never, {
      getIdentity: vi.fn().mockResolvedValue(null),
      resolve,
    })
    expect(result.user).toBeNull()
    expect(resolve).not.toHaveBeenCalled()
  })

  it('withholds roleless users and returns recognized roles', async () => {
    const getIdentity = vi.fn().mockResolvedValue(identity)
    const roleless = await authenticateAuth0PayloadUser(new Headers(), {} as never, {
      getIdentity,
      resolve: vi.fn().mockResolvedValue({ id: 1, roles: [] }),
    })
    expect(roleless.user).toBeNull()

    const editor = await authenticateAuth0PayloadUser(new Headers(), {} as never, {
      getIdentity,
      resolve: vi.fn().mockResolvedValue({ id: 1, roles: ['editor'] }),
    })
    expect(editor.user).toMatchObject({ id: 1, collection: 'users' })
  })
})
