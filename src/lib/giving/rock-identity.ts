import { createHash, randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import type { Pool, PoolClient } from 'pg'

import type { GivingContext, ProviderOperationAction, ProviderOperationStatus } from './contracts'
import {
  bindCheckoutGiver,
  createIdentityFingerprint,
  markProviderOperationFailed,
  markProviderOperationSubmitted,
  markProviderOperationSucceeded,
  markProviderOperationUnknown,
  prepareProviderOperation,
  upsertGiverByAlias,
  withIdentityFingerprintLock,
} from './repository'
import type { GivingRockClient, GivingRockPerson } from './rock-client'

const MAX_EMAIL_LENGTH = 320
const MAX_NAME_LENGTH = 100
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u

export type GivingIdentityErrorCode =
  | 'identity-invalid'
  | 'identity-unknown'
  | 'identity-failed'
  | 'bank-reference-invalid'

export class GivingIdentityResolutionError extends Error {
  constructor(public readonly code: GivingIdentityErrorCode) {
    const detail: Record<GivingIdentityErrorCode, string> = {
      'identity-invalid': 'Giving identity email or name is invalid',
      'identity-unknown': 'Giving identity resolution is unknown',
      'identity-failed': 'Giving identity resolution failed',
      'bank-reference-invalid': 'Rock alias must produce a bank reference of 12 characters or fewer',
    }
    super(detail[code])
    this.name = 'GivingIdentityResolutionError'
  }
}

export type GivingIdentityInput =
  | { kind: 'guest'; firstName: string; lastName: string; email: string }
  | { kind: 'member'; personAliasId: number; firstName: string; lastName: string; email: string }

export interface ResolveGivingIdentityInput extends GivingContext {
  checkoutId: number
  identity: GivingIdentityInput
}

export interface ResolvedGivingIdentity {
  giverId: number
  personAliasId: number
  bankReference: string
  firstName: string
  lastName: string
  email: string
}

export interface GivingIdentityOperation {
  id: number
  status: ProviderOperationStatus
  providerId: string | null
  correlationKey: string
  requestDigest: string
}

interface PrepareIdentityOperationInput extends GivingContext {
  checkoutId: number
  action: Extract<ProviderOperationAction, 'rock.resolve-giver' | 'rock.create-giver'>
  correlationKey: string
  requestDigest: string
}

interface CommitIdentityInput extends GivingContext {
  checkoutId: number
  operation: GivingIdentityOperation
  rockPersonAliasId: number
  bankReference: string
  name: string
  email: string
}

export interface GivingIdentityRepository {
  withFingerprintLock<T>(fingerprint: string, work: () => Promise<T>): Promise<T>
  findOperation(checkoutId: number, action: PrepareIdentityOperationInput['action']): Promise<GivingIdentityOperation | null>
  prepareOperation(input: PrepareIdentityOperationInput): Promise<GivingIdentityOperation>
  markSubmitted(operationId: number): Promise<void>
  markUnknown(operationId: number, errorCode: string): Promise<void>
  markFailed(operationId: number, errorCode: string): Promise<void>
  commitSuccess(input: CommitIdentityInput): Promise<number>
}

interface ResolveGivingIdentityDependencies {
  rockClient: GivingRockClient
  repository: GivingIdentityRepository
  fingerprintSecret: string
  createGuid?: () => string
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function normaliseName(value: unknown) {
  if (typeof value !== 'string') throw new GivingIdentityResolutionError('identity-invalid')
  const name = value.normalize('NFC').trim()
  if (!name || name.length > MAX_NAME_LENGTH || CONTROL_CHARACTERS.test(name)) {
    throw new GivingIdentityResolutionError('identity-invalid')
  }
  return name
}

export function normaliseGivingEmail(value: unknown): string {
  if (typeof value !== 'string') throw new GivingIdentityResolutionError('identity-invalid')
  const email = value.normalize('NFC').trim().toLowerCase()
  const [local, domain, ...extra] = email.split('@')
  if (
    !email ||
    email.length > MAX_EMAIL_LENGTH ||
    CONTROL_CHARACTERS.test(email) ||
    !EMAIL_PATTERN.test(email) ||
    !local ||
    local.length > 64 ||
    !domain ||
    domain.length > 255 ||
    extra.length > 0 ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..') ||
    domain.startsWith('.') ||
    domain.endsWith('.') ||
    domain.includes('..')
  ) {
    throw new GivingIdentityResolutionError('identity-invalid')
  }
  return email
}

export function bankReferenceForAlias(personAliasId: number): string {
  if (!positiveInteger(personAliasId)) throw new GivingIdentityResolutionError('bank-reference-invalid')
  const reference = `EV${personAliasId}`
  if (reference.length > 12) throw new GivingIdentityResolutionError('bank-reference-invalid')
  return reference
}

function requestDigest(parts: string[]) {
  return createHash('sha256').update(parts.join(':')).digest('hex')
}

function exactEmailMatches(people: GivingRockPerson[], email: string) {
  return people.filter((person) => {
    try {
      return normaliseGivingEmail(person.email) === email
    } catch {
      return false
    }
  })
}

function operationAlias(operation: GivingIdentityOperation) {
  const alias = Number(operation.providerId)
  if (!positiveInteger(alias)) throw new GivingIdentityResolutionError('identity-failed')
  return alias
}

function unknownProviderResult(error: unknown): error is { outcome: 'unknown' } {
  return typeof error === 'object' && error !== null && 'outcome' in error && error.outcome === 'unknown'
}

async function bindResolvedIdentity(
  input: ResolveGivingIdentityInput,
  operation: GivingIdentityOperation,
  alias: number,
  identity: { firstName: string; lastName: string; email: string },
  repository: GivingIdentityRepository,
) {
  const bankReference = bankReferenceForAlias(alias)
  const giverId = await repository.commitSuccess({
    contextKey: input.contextKey,
    environment: input.environment,
    synthetic: input.synthetic,
    checkoutId: input.checkoutId,
    operation,
    rockPersonAliasId: alias,
    bankReference,
    name: `${identity.firstName} ${identity.lastName}`,
    email: identity.email,
  })
  return { giverId, personAliasId: alias, bankReference, ...identity }
}

async function recoverCreate(
  operation: GivingIdentityOperation,
  rockClient: GivingRockClient,
) {
  try {
    return await rockClient.findPersonByGuid(operation.correlationKey)
  } catch {
    throw new GivingIdentityResolutionError('identity-unknown')
  }
}

async function executeCreateOperation(
  input: ResolveGivingIdentityInput,
  operation: GivingIdentityOperation,
  identity: { firstName: string; lastName: string; email: string },
  dependencies: ResolveGivingIdentityDependencies,
) {
  if (operation.status === 'succeeded') {
    return bindResolvedIdentity(
      input,
      operation,
      operationAlias(operation),
      identity,
      dependencies.repository,
    )
  }
  if (operation.status === 'submitted' || operation.status === 'unknown') {
    const recovered = await recoverCreate(operation, dependencies.rockClient)
    if (!recovered) throw new GivingIdentityResolutionError('identity-unknown')
    return bindResolvedIdentity(
      input,
      operation,
      recovered.primaryAliasId,
      identity,
      dependencies.repository,
    )
  }
  if (operation.status === 'failed') throw new GivingIdentityResolutionError('identity-failed')

  await dependencies.repository.markSubmitted(operation.id)
  const submittedOperation = { ...operation, status: 'submitted' as const }
  let created: GivingRockPerson
  try {
    created = await dependencies.rockClient.createPerson({
      ...identity,
      guid: operation.correlationKey,
    })
  } catch (error) {
    if (!unknownProviderResult(error)) {
      await dependencies.repository.markFailed(operation.id, 'rock-create-rejected')
      throw new GivingIdentityResolutionError('identity-failed')
    }
    await dependencies.repository.markUnknown(operation.id, 'rock-create-unknown')
    const recovered = await recoverCreate(operation, dependencies.rockClient)
    if (!recovered) throw new GivingIdentityResolutionError('identity-unknown')
    created = recovered
  }
  return bindResolvedIdentity(
    input,
    submittedOperation,
    created.primaryAliasId,
    identity,
    dependencies.repository,
  )
}

export async function resolveGivingIdentity(
  input: ResolveGivingIdentityInput,
  dependencies: ResolveGivingIdentityDependencies,
): Promise<ResolvedGivingIdentity> {
  const firstName = normaliseName(input.identity.firstName)
  const lastName = normaliseName(input.identity.lastName)
  const email = normaliseGivingEmail(input.identity.email)
  const identity = { firstName, lastName, email }
  const fingerprint = createIdentityFingerprint(email, dependencies.fingerprintSecret)

  return dependencies.repository.withFingerprintLock(fingerprint, async () => {
    if (input.synthetic) {
      const alias = input.checkoutId
      const correlationKey = `synthetic-alias:${alias}`
      const operation = await dependencies.repository.prepareOperation({
        ...input,
        action: 'rock.resolve-giver',
        correlationKey,
        requestDigest: requestDigest([input.contextKey, String(input.checkoutId), correlationKey, fingerprint]),
      })
      if (operation.status === 'prepared') await dependencies.repository.markSubmitted(operation.id)
      return bindResolvedIdentity(
        input,
        operation.status === 'prepared' ? { ...operation, status: 'submitted' } : operation,
        alias,
        identity,
        dependencies.repository,
      )
    }

    const priorCreate = await dependencies.repository.findOperation(input.checkoutId, 'rock.create-giver')
    if (priorCreate) {
      const expectedDigest = requestDigest([
        input.contextKey,
        String(input.checkoutId),
        priorCreate.correlationKey,
        fingerprint,
      ])
      if (priorCreate.requestDigest !== expectedDigest) {
        throw new GivingIdentityResolutionError('identity-invalid')
      }
      if (priorCreate.status === 'succeeded') {
        await dependencies.rockClient.getPersonByAlias(operationAlias(priorCreate))
      }
      return executeCreateOperation(input, priorCreate, identity, dependencies)
    }

    let alias: number | null = null
    if (input.identity.kind === 'member') {
      if (!positiveInteger(input.identity.personAliasId)) throw new GivingIdentityResolutionError('identity-invalid')
      await dependencies.rockClient.getPersonByAlias(input.identity.personAliasId)
      alias = input.identity.personAliasId
    } else {
      const matches = exactEmailMatches(
        await dependencies.rockClient.findActivePeopleByEmail(email),
        email,
      )
      if (matches.length === 1) alias = matches[0].primaryAliasId
    }

    if (alias !== null) {
      const correlationKey = `rock-alias:${alias}`
      const operation = await dependencies.repository.prepareOperation({
        ...input,
        action: 'rock.resolve-giver',
        correlationKey,
        requestDigest: requestDigest([input.contextKey, String(input.checkoutId), correlationKey, fingerprint]),
      })
      if (operation.status === 'prepared') await dependencies.repository.markSubmitted(operation.id)
      return bindResolvedIdentity(
        input,
        operation.status === 'prepared' ? { ...operation, status: 'submitted' } : operation,
        alias,
        identity,
        dependencies.repository,
      )
    }

    const guid = (dependencies.createGuid ?? randomUUID)().toLowerCase()
    const operation = await dependencies.repository.prepareOperation({
      ...input,
      action: 'rock.create-giver',
      correlationKey: guid,
      requestDigest: requestDigest([input.contextKey, String(input.checkoutId), guid, fingerprint]),
    })
    return executeCreateOperation(input, operation, identity, dependencies)
  })
}

async function inTransaction<T>(client: PoolClient, work: () => Promise<T>) {
  await client.query('BEGIN')
  try {
    const value = await work()
    await client.query('COMMIT')
    return value
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

export function createGivingIdentityRepository(pool: Pool): GivingIdentityRepository {
  const clients = new AsyncLocalStorage<PoolClient>()
  const client = () => {
    const current = clients.getStore()
    if (!current) throw new Error('Giving identity repository requires the fingerprint lock')
    return current
  }

  return {
    withFingerprintLock(fingerprint, work) {
      return withIdentityFingerprintLock(pool, fingerprint, async (session) => {
        return clients.run(session, work)
      })
    },
    async findOperation(checkoutId, action) {
      const result = await client().query<{
        id: number
        status: ProviderOperationStatus
        provider_id: string | null
        correlation_key: string
        request_digest: string
      }>(`SELECT id,status,provider_id,correlation_key,request_digest FROM giving_provider_operations
        WHERE checkout_id=$1 AND provider='rock' AND action=$2 AND logical_version=1`, [checkoutId, action])
      const operation = result.rows[0]
      return operation ? {
        id: operation.id,
        status: operation.status,
        providerId: operation.provider_id,
        correlationKey: operation.correlation_key,
        requestDigest: operation.request_digest,
      } : null
    },
    async prepareOperation(input) {
      const prepared = await prepareProviderOperation(client(), {
        ...input,
        provider: 'rock',
        logicalVersion: 1,
      })
      return { ...prepared, correlationKey: input.correlationKey, requestDigest: input.requestDigest }
    },
    markSubmitted(operationId) {
      return markProviderOperationSubmitted(client(), operationId, {})
    },
    markUnknown(operationId, errorCode) {
      return markProviderOperationUnknown(client(), operationId, { errorCode })
    },
    markFailed(operationId, errorCode) {
      return markProviderOperationFailed(client(), operationId, { errorCode })
    },
    commitSuccess(input) {
      return inTransaction(client(), async () => {
        const giverId = await upsertGiverByAlias(client(), input)
        await bindCheckoutGiver(client(), input.checkoutId, giverId, input.contextKey)
        if (input.operation.status !== 'succeeded') {
          await markProviderOperationSucceeded(client(), input.operation.id, {
            providerId: String(input.rockPersonAliasId),
          })
        }
        return giverId
      })
    },
  }
}
