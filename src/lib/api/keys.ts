import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import { rockFetch } from '@/lib/rock-api'
import { transaction } from './database'

import type { ApiKeySummary, ApiScope } from './contract'

type Database = Pick<Pool, 'query'>
interface KeyRow {
  id: string; name: string; person_id: number; person_name: string; person_email: string;
  scopes: ApiScope[]; expires_at: Date | null; revoked_at: Date | null; created_at: Date; last_used_at: Date | null; rate_count: number;
}
export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number, public retryAfter?: number, public keyId?: string) { super(message) }
}
export interface Principal { key: ApiKeySummary; actor: { personId: number; name: string; email: string; apiKey: {id: string; name: string} } }
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
function summary(row: KeyRow): ApiKeySummary {
  return { id: row.id, name: row.name, personId: Number(row.person_id), personName: row.person_name, personEmail: row.person_email,
    scopes: row.scopes, expiresAt: row.expires_at?.toISOString() ?? null, revokedAt: row.revoked_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(), lastUsedAt: row.last_used_at?.toISOString() ?? null }
}
export async function audit(db: Database, keyId: string | null, action: string, status: number, details: Record<string, unknown> = {}, adminId: number | null = null) {
  await db.query('INSERT INTO api_audit(key_id,admin_id,action,status,details) VALUES($1,$2,$3,$4,$5::jsonb)', [keyId, adminId, action, status, JSON.stringify(details)])
}
export async function resolveKeyPerson(personId: number) {
  const person = await rockFetch<{ Id: number; NickName: string; LastName: string; Email: string }>({ endpoint: `People/${personId}`, params: { $select: 'Id,NickName,LastName,Email' }, timeoutMs: 3000, retries: 0 })
  if (person.Id !== personId || !person.Email) throw new ApiError('person_unavailable', 'Choose a Rock person with an email address.', 400)
  return { personId, name: `${person.NickName} ${person.LastName}`, email: person.Email }
}
export function requireScope(key: ApiKeySummary, scope: ApiScope) {
  if (!key.scopes.includes(scope)) throw new ApiError('insufficient_scope', `This API key requires ${scope}.`, 403)
}
export async function authenticate(pool: Pool, authorization: string | null): Promise<Principal> {
  const match = /^Bearer (ev_api_[a-f0-9]{32}_[A-Za-z0-9_-]{43})$/.exec(authorization ?? '')
  if (!match) throw new ApiError('unauthorized','A valid Bearer API key is required.',401)
  const result = await pool.query<KeyRow>(`UPDATE api_keys SET last_used_at=now(),
    rate_count=CASE WHEN rate_window<=now()-interval '1 minute' THEN 1 ELSE rate_count+1 END,
    rate_window=CASE WHEN rate_window<=now()-interval '1 minute' THEN now() ELSE rate_window END
    WHERE secret_hash=$1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now()) RETURNING *`,[hash(match[1])])
  const row = result.rows[0]
  if (!row) throw new ApiError('unauthorized','The API key is invalid, expired, or revoked.',401)
  if (row.rate_count > 120) throw new ApiError('rate_limited','Limit: 120 requests per minute per key.',429,60,row.id)
  let person: Awaited<ReturnType<typeof resolveKeyPerson>>
  try { person = await resolveKeyPerson(Number(row.person_id)) }
  catch { throw new ApiError('identity_unavailable','The key owner could not be verified. Try again later.',503,undefined,row.id) }
  const key = summary(row)
  return { key, actor: { ...person, apiKey: { id: key.id, name: key.name } } }
}
/** Lock the credential throughout a write so revocation/scope changes cannot race its commit. */
export async function lockKey(db: PoolClient, principal: Principal, scope: ApiScope): Promise<Principal> {
  const result = await db.query<KeyRow>('SELECT * FROM api_keys WHERE id=$1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now()) FOR UPDATE',[principal.key.id])
  if (!result.rows[0]) throw new ApiError('unauthorized','The API key is expired or revoked.',401)
  const key = summary(result.rows[0]); requireScope(key,scope)
  return { key, actor: { ...principal.actor, apiKey: { id: key.id, name: key.name } } }
}

/** Generate only once; the normal Payload document manages its owner and permissions. */
export async function generateSecret(pool: Pool, id: string, adminId: number) {
  const secret = `ev_api_${randomUUID().replaceAll('-', '')}_${randomBytes(32).toString('base64url')}`
  return transaction(pool, async db => {
    const result = await db.query(`UPDATE api_keys SET secret_hash=$2, generated_at=now(), updated_at=now()
      WHERE id=$1 AND secret_hash IS NULL AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now()) RETURNING id`,[id,hash(secret)])
    if (!result.rowCount) throw new ApiError('conflict','This key is missing, expired, revoked, or already generated.',409)
    await audit(db,id,'key.generated',200,{},adminId)
    return {secret}
  })
}
