import { describe, expect, it, vi } from 'vitest'

import { provisionAuth0User } from './provision-auth0-user'

const identity = {
  identityKey: 'identity-key',
  issuer: 'https://tenant.example/',
  subject: 'auth0|123',
  email: 'staff@ev.church',
  name: 'Staff Member',
}

describe('Auth0 user provisioning', () => {
  it('creates a user without roles and returns the winning record', async () => {
    const existing = vi.fn().mockResolvedValueOnce({ docs: [] })
    const create = vi.fn().mockResolvedValue({ id: 1, ...identity, roles: [] })
    const payload = { find: existing, create } as never

    const result = await provisionAuth0User(payload, identity)

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        overrideAccess: true,
        data: expect.not.objectContaining({ roles: expect.anything() }),
      }),
    )
    expect(result).toMatchObject({ id: 1, roles: [] })
  })

  it('fails closed when the email belongs to another identity', async () => {
    const payload = {
      find: vi
        .fn()
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [{ id: 2, auth0IdentityKey: 'other' }] }),
      create: vi.fn().mockRejectedValue(new Error('email duplicate')),
    } as never

    await expect(provisionAuth0User(payload, identity)).rejects.toThrow(
      'Unable to provision Auth0 user',
    )
  })
})
