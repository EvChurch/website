import { createHmac } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import type { Payload } from 'payload'
import type { GivingContext, ProviderOperationAction, ProviderOperationProvider, ProviderOperationStatus } from './contracts'
import { assertPositiveMinorUnits } from './domain'

/** Re-read an active fund immediately before any provider operation. */
export async function requireActiveGivingFund(payload: Payload, id: number) {
  const fund = await payload.findByID({ collection: 'giving-funds', id, depth: 0 })
  if (!fund.active) throw new Error('The selected giving fund is no longer active')
  return { id: fund.id, name: fund.name, code: fund.code, accountingKey: fund.accountingKey }
}

export function prepareGiftAmount(amountMinor: number): number {
  return assertPositiveMinorUnits(amountMinor)
}

export interface PrepareProviderOperationInput extends GivingContext {
  checkoutId: number
  provider: ProviderOperationProvider
  action: ProviderOperationAction
  logicalVersion: number
  requestDigest: string
  correlationKey: string
}

export function createIdentityFingerprint(normalisedEmail: string, secret: string): string {
  if (secret.length < 32) throw new Error('Giving identity fingerprint secret must be at least 32 characters')
  return createHmac('sha256', secret).update(normalisedEmail).digest('hex')
}

export async function withGivingTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}

export async function acquireIdentityFingerprintLock(client: PoolClient, fingerprint: string): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [fingerprint])
}

/** Holds one dedicated PostgreSQL session lock across re-read/create and an external Rock call. */
export async function withIdentityFingerprintLock<T>(pool: Pool, fingerprint: string, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [fingerprint])
    return await work(client)
  } finally {
    try { await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [fingerprint]) } finally { client.release() }
  }
}

export async function upsertGiverByAlias(client: PoolClient, input: GivingContext & { rockPersonAliasId: number; bankReference: string; name: string; email: string }): Promise<number> {
  const result = await client.query<{ id: number }>(`INSERT INTO giving_givers (context_key, environment, synthetic, e2e_run_id, rock_person_alias_id, bank_reference, name, email)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (context_key, rock_person_alias_id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,updated_at=now()
    RETURNING id`, [input.contextKey, input.environment, input.synthetic, input.e2eRunId, input.rockPersonAliasId, input.bankReference, input.name, input.email])
  return result.rows[0].id
}

export async function bindCheckoutGiver(client: PoolClient, checkoutId: number, giverId: number, contextKey: string): Promise<void> {
  const result = await client.query(`UPDATE giving_checkouts SET giver_id=$2,updated_at=now() WHERE id=$1 AND context_key=$3 AND (giver_id IS NULL OR giver_id=$2)`, [checkoutId,giverId,contextKey])
  if (result.rowCount !== 1) throw new Error('Checkout giver binding is stale or crosses giving context')
}

export interface PreparedProviderOperation { id: number; status: ProviderOperationStatus; providerId: string | null }

export async function prepareProviderOperation(client: PoolClient, input: PrepareProviderOperationInput): Promise<PreparedProviderOperation> {
  const contextKey = input.contextKey
  await client.query(`INSERT INTO giving_provider_operations
    (context_key,environment,synthetic,e2e_run_id,checkout_id,provider,action,logical_version,request_digest,correlation_key,status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'prepared')
    ON CONFLICT (checkout_id,provider,action,logical_version) DO NOTHING`, [contextKey, input.environment, input.synthetic, input.e2eRunId, input.checkoutId, input.provider, input.action, input.logicalVersion, input.requestDigest, input.correlationKey])
  const result = await client.query<{ id: number; status: ProviderOperationStatus; provider_id: string | null; request_digest: string; correlation_key: string; context_key: string }>(`SELECT id,status,provider_id,request_digest,correlation_key,context_key FROM giving_provider_operations WHERE checkout_id=$1 AND provider=$2 AND action=$3 AND logical_version=$4 FOR UPDATE`, [input.checkoutId,input.provider,input.action,input.logicalVersion])
  const operation = result.rows[0]
  if (!operation || operation.request_digest !== input.requestDigest || operation.correlation_key !== input.correlationKey || operation.context_key !== contextKey) throw new Error('Provider operation does not match the prepared semantic action')
  return { id: operation.id, status: operation.status, providerId: operation.provider_id }
}

export async function markProviderOperation(client: PoolClient, operationId: number, status: Exclude<ProviderOperationStatus, 'prepared'>, attempt: { providerRequestId?: string; providerId?: string; errorCode?: string }): Promise<void> {
  const legalFrom: Record<Exclude<ProviderOperationStatus, 'prepared'>, ProviderOperationStatus[]> = { submitted: ['prepared'], succeeded: ['submitted','unknown'], unknown: ['submitted'], failed: ['prepared','submitted','unknown'] }
  if (attempt.providerId && status !== 'succeeded') throw new Error('Provider ID can only be bound on success')
  const transitioned = await client.query(`WITH updated AS (
      UPDATE giving_provider_operations SET status=$2,provider_request_id=COALESCE($3,provider_request_id),provider_id=CASE WHEN $2='succeeded' THEN COALESCE($4,provider_id) ELSE provider_id END,updated_at=now()
      WHERE id=$1 AND status=ANY($6::varchar[]) AND ($4::varchar IS NULL OR provider_id IS NULL OR provider_id=$4) RETURNING id
    ), next_attempt AS (SELECT COALESCE(MAX(attempt_number),0)+1 AS value FROM giving_provider_operation_attempts WHERE operation_id=$1)
    INSERT INTO giving_provider_operation_attempts(operation_id,attempt_number,outcome,provider_request_id,error_code)
    SELECT updated.id,next_attempt.value,$2,$3,$5 FROM updated CROSS JOIN next_attempt RETURNING id`, [operationId,status,attempt.providerRequestId ?? null,attempt.providerId ?? null,attempt.errorCode ?? null,legalFrom[status]])
  if (transitioned.rowCount !== 1) throw new Error(`Illegal or stale provider operation transition to ${status}`)
}

export const markProviderOperationSubmitted = (client: PoolClient, id: number, attempt: { providerRequestId?: string }) => markProviderOperation(client,id,'submitted',attempt)
export const markProviderOperationSucceeded = (client: PoolClient, id: number, attempt: { providerRequestId?: string; providerId?: string }) => markProviderOperation(client,id,'succeeded',attempt)
export const markProviderOperationUnknown = (client: PoolClient, id: number, attempt: { providerRequestId?: string; errorCode?: string }) => markProviderOperation(client,id,'unknown',attempt)
export const markProviderOperationFailed = (client: PoolClient, id: number, attempt: { providerRequestId?: string; errorCode?: string }) => markProviderOperation(client,id,'failed',attempt)
