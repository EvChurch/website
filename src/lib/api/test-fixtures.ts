import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import { audit, generateSecret } from './keys'
import { createKeySchema, type ApiKeySummary } from './contract'

/** Isolated workflow-test fixtures; production key CRUD belongs to Payload. */
export async function createKey(pool: Pool, adminId: number, input: unknown) {
  const command = createKeySchema.parse(input)
  const key: ApiKeySummary = {
    id:randomUUID(), name:command.name, personId:command.personId, personName:`Person ${command.personId}`,
    personEmail:`person${command.personId}@example.com`, scopes:command.scopes,
    expiresAt:command.expiresAt === undefined ? new Date(Date.now()+365*86400000).toISOString() : command.expiresAt,
    revokedAt:null, createdAt:new Date().toISOString(), lastUsedAt:null,
  }
  await pool.query('INSERT INTO api_keys(id,name,person_id,person_name,person_email,scopes,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[key.id,key.name,key.personId,key.personName,key.personEmail,JSON.stringify(key.scopes),key.expiresAt])
  return {key,...await generateSecret(pool,key.id,adminId)}
}
export async function updateKey(pool: Pool, adminId: number, id: string, input: {name:string;scopes:string[];expiresAt:string|null} | null, revoke = false) {
  if (revoke) await pool.query('UPDATE api_keys SET revoked_at=now(),revoked=true WHERE id=$1',[id])
  else await pool.query('UPDATE api_keys SET name=$2,scopes=$3,expires_at=$4 WHERE id=$1',[id,input!.name,JSON.stringify(input!.scopes),input!.expiresAt])
  await audit(pool,id,revoke?'key.revoked':'key.updated',200,{},adminId)
}
