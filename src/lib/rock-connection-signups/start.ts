import {
  createRockConnectionContextToken,
  createRockConnectionNonce,
  type RockConnectionContext,
} from './context-token'
import {
  createPostgresNonceStore,
  digestConnectionNonce,
  type ConnectionNonceStore,
} from './nonce-store'
import { initializeRockConnectionSignup } from './server'
import type { RockConnectionSignupSchema } from './types'

export type PublicRockConnectionSignupSchema = Omit<
  RockConnectionSignupSchema,
  'sessionGuid' | 'interactionGuid'
>

export function connectionContextClaimsFromSchema(
  schema: RockConnectionSignupSchema,
) {
  return {
    pageGuid: schema.pageGuid,
    blockGuid: schema.blockGuid,
    opportunityGuid: schema.opportunityGuid,
    sessionGuid: schema.sessionGuid,
    interactionGuid: schema.interactionGuid,
    campuses: schema.campuses.map(({ value }) => value),
    selectedCampusId: schema.selectedCampusId,
    displayHomePhone: schema.displayHomePhone,
    displayMobilePhone: schema.displayMobilePhone,
    attributes: schema.attributes.map(
      ({
        attributeGuid,
        fieldTypeGuid,
        key,
        isRequired,
        configurationValues,
      }) => ({
        attributeGuid,
        fieldTypeGuid,
        key,
        isRequired,
        configurationValues,
      }),
    ),
  }
}

function connectionContextFromSchema(
  schema: RockConnectionSignupSchema,
  now: number,
): RockConnectionContext {
  return {
    version: 1,
    purpose: 'rock-connection-signup',
    audience: 'ev.church',
    ...connectionContextClaimsFromSchema(schema),
    nonce: createRockConnectionNonce(),
    issuedAt: now,
    expiresAt: now + 5 * 60_000,
  }
}

function publicSchema(
  schema: RockConnectionSignupSchema,
): PublicRockConnectionSignupSchema {
  const { sessionGuid: _sessionGuid, interactionGuid: _interactionGuid, ...safe } =
    schema
  return safe
}

export async function startRockConnectionSignup({
  blockGuid,
  nonceStore = createPostgresNonceStore(),
  now = Date.now(),
}: {
  blockGuid: string
  nonceStore?: ConnectionNonceStore
  now?: number
}) {
  const schema = await initializeRockConnectionSignup(blockGuid)
  const context = connectionContextFromSchema(schema, now)
  await nonceStore.create({
    nonceDigest: digestConnectionNonce(context.nonce),
    purpose: context.purpose,
    pageGuid: context.pageGuid,
    blockGuid: context.blockGuid,
    expiresAt: new Date(context.expiresAt),
  })

  return {
    schema: publicSchema(schema),
    contextToken: createRockConnectionContextToken(context),
  }
}
