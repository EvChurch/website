import type { AuthStrategy, AuthStrategyResult, Payload } from 'payload'
import type { User } from '@/payload-types'

import { hasPayloadAdminRole } from '@/access/roles'
import type { Auth0Identity } from './auth0-identity'

interface StrategyDependencies {
  getIdentity(headers: Headers): Promise<Auth0Identity | null>
  resolve(payload: Payload, identity: Auth0Identity): Promise<User | null>
}

export async function authenticateAuth0PayloadUser(
  headers: Headers,
  payload: Payload,
  dependencies?: StrategyDependencies,
): Promise<AuthStrategyResult> {
  let deps = dependencies
  if (!deps) {
    const [{ getAuth0SessionFromHeaders }, { resolveAuth0User }] =
      await Promise.all([import('./auth0-session'), import('./resolve-auth0-user')])
    deps = {
      getIdentity: getAuth0SessionFromHeaders,
      resolve: resolveAuth0User,
    }
  }

  const identity = await deps.getIdentity(headers)
  if (!identity) return { user: null }

  const user = await deps.resolve(payload, identity)
  if (!user || !hasPayloadAdminRole(user)) return { user: null }
  return { user: { ...user, collection: 'users' as const } }
}

export const auth0PayloadStrategy: AuthStrategy = {
  name: 'auth0-admin',
  async authenticate({ headers, payload }) {
    return authenticateAuth0PayloadUser(headers, payload)
  },
}
