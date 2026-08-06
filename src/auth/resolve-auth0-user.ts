import type { Payload } from 'payload'
import type { User } from '@/payload-types'

import type { Auth0Identity } from './auth0-identity'

export async function resolveAuth0User(
  payload: Payload,
  identity: Auth0Identity,
): Promise<User | null> {
  const result = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: { auth0IdentityKey: { equals: identity.identityKey } },
  })
  const user = result.docs[0] as User | undefined
  if (!user || user.auth0IdentityKey !== identity.identityKey) return null
  return user
}
