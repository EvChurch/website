import type { Pool, PoolClient } from 'pg'
import { authenticate as authenticateKey, lockKey as lockApiKey, type Principal as ApiPrincipal } from '@/lib/api/keys'
import type { ApiScope } from '@/lib/api/contract'
import type { Actor } from '../model'
import { isFinance } from '../store'
export interface Principal { key: ApiPrincipal['key']; actor: Actor & ApiPrincipal['actor'] }
export async function authenticate(pool: Pool, authorization: string | null): Promise<Principal> {
  const principal = await authenticateKey(pool, authorization)
  return {key: principal.key, actor: {...principal.actor, admin: false, finance: await isFinance(pool, principal.actor.personId)}}
}
export async function lockKey(db: PoolClient, principal: Principal, scope: ApiScope): Promise<Principal> {
  const current = await lockApiKey(db, principal, scope)
  return {key: current.key, actor: {...current.actor, admin: false, finance: await isFinance(db, current.actor.personId)}}
}
