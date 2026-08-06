import { describe, expect, it } from 'vitest'

import { auth0IdentityKey, identityFromSessionUser } from './auth0-identity'

describe('Auth0 identity', () => {
  it('keys identity by issuer and subject instead of email', () => {
    expect(auth0IdentityKey('https://tenant.example/', 'auth0|123')).toBe(
      auth0IdentityKey('https://tenant.example/', 'auth0|123'),
    )
    expect(auth0IdentityKey('https://other.example/', 'auth0|123')).not.toBe(
      auth0IdentityKey('https://tenant.example/', 'auth0|123'),
    )
  })

  it('requires a verified email and non-empty subject', () => {
    expect(
      identityFromSessionUser('https://tenant.example/', {
        sub: 'auth0|123',
        email: 'staff@ev.church',
        email_verified: true,
        name: 'Staff Member',
      }),
    ).toMatchObject({
      issuer: 'https://tenant.example/',
      subject: 'auth0|123',
      email: 'staff@ev.church',
      name: 'Staff Member',
    })

    expect(
      identityFromSessionUser('https://tenant.example/', {
        sub: 'auth0|123',
        email: 'staff@ev.church',
        email_verified: false,
      }),
    ).toBeNull()
    expect(
      identityFromSessionUser('https://tenant.example/', {
        sub: '',
        email: 'staff@ev.church',
        email_verified: true,
      }),
    ).toBeNull()
  })
})
