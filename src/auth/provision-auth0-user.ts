import type { Payload } from 'payload'
import type { User } from '@/payload-types'

import type { Auth0Identity } from './auth0-identity'
import { resolveAuth0User } from './resolve-auth0-user'

export async function provisionAuth0User(
  payload: Payload,
  identity: Auth0Identity,
): Promise<User> {
  const existing = await resolveAuth0User(payload, identity)
  if (existing) return existing

  try {
    return (await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        name: identity.name,
        email: identity.email,
        auth0IdentityKey: identity.identityKey,
        auth0Issuer: identity.issuer,
        auth0Subject: identity.subject,
      },
    })) as User
  } catch {
    const winner = await resolveAuth0User(payload, identity)
    if (winner) return winner
    throw new Error('Unable to provision Auth0 user')
  }
}
