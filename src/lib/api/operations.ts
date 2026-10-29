import type { PoolClient } from 'pg'
import { ApiError } from './keys'

/** Call inside a transaction after locking the key and checking current authority. */
export async function executeOnce(db: PoolClient, keyId: string, operationId: string, requestHash: string, execute: () => Promise<unknown>) {
  const existing = (await db.query<{request_hash:string;response:unknown}>('SELECT request_hash,response FROM api_operations WHERE key_id=$1 AND operation_id=$2',[keyId,operationId])).rows[0]
  if (existing) {
    if (existing.request_hash !== requestHash) throw new ApiError('idempotency_conflict','This Idempotency-Key was used for a different request.',409)
    return {response:existing.response,replay:true}
  }
  const response = await execute()
  await db.query('INSERT INTO api_operations(key_id,operation_id,request_hash,response) VALUES($1,$2,$3,$4::jsonb)',[keyId,operationId,requestHash,JSON.stringify(response)])
  return {response,replay:false}
}
