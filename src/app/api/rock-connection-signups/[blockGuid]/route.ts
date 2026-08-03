import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

import { getTurnstileSiteKey } from '@/lib/rock-forms/config'
import {
  createRockConnectionContextToken,
  createRockConnectionNonce,
  verifyRockConnectionContextToken,
  type RockConnectionContext,
} from '@/lib/rock-connection-signups/context-token'
import {
  createPostgresNonceStore,
  digestConnectionNonce,
  type ConnectionNonceStore,
} from '@/lib/rock-connection-signups/nonce-store'
import { isRockConnectionSignupPublished } from '@/lib/rock-connection-signups/published'
import {
  ConnectionRateLimitError,
  createPostgresRateLimitStore,
  enforceConnectionRateLimit,
  trustedConnectionClientAddress,
  type ConnectionRateLimitStore,
} from '@/lib/rock-connection-signups/rate-limit'
import {
  initializeRockConnectionSignup,
  RockConnectionSignupOutcomeUnknownError,
  sendRockConnectionSignup,
} from '@/lib/rock-connection-signups/server'
import type { RockConnectionSignupSchema } from '@/lib/rock-connection-signups/types'
import {
  sanitizeRockResponseMessage,
  validateRockConnectionSubmission,
} from '@/lib/rock-connection-signups/validation'
import { isSameOriginRequest } from '@/lib/request-origin'
import { verifyTurnstileToken } from '@/lib/turnstile'

export const dynamic = 'force-dynamic'
export const ROCK_CONNECTION_START_ACTION = 'rock-connection-signup-start'
export const ROCK_CONNECTION_SUBMIT_ACTION = 'rock-connection-signup-submit'

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' }
const MAX_REQUEST_BYTES = 128_000
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SAFE_TURNSTILE_ERRORS = new Set([
  'Please complete the bot check',
  'The bot check expired or could not be verified',
  'The bot check was issued for a different website',
  'The bot check was issued for a different action',
])

type RouteContext = { params: Promise<{ blockGuid: string }> }
type RouteDependencies = {
  nonceStore: ConnectionNonceStore
  rateLimitStore: ConnectionRateLimitStore
}

function response(value: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(value, { status, headers: { ...NO_STORE, ...headers } })
}

function errorResponse(message: string, status: number, headers?: Record<string, string>) {
  return response({ error: message }, status, headers)
}

async function boundedJson(request: NextRequest): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > MAX_REQUEST_BYTES) throw new Error('Invalid request')
  const text = await request.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_REQUEST_BYTES) throw new Error('Invalid request')
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('Invalid request')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 4) throw new Error('Invalid request')
  return value as Record<string, unknown>
}

function contextFromSchema(schema: RockConnectionSignupSchema, now: number): RockConnectionContext {
  return {
    version: 1,
    purpose: 'rock-connection-signup',
    audience: 'ev.church',
    pageGuid: schema.pageGuid,
    blockGuid: schema.blockGuid,
    opportunityGuid: schema.opportunityGuid,
    sessionGuid: schema.sessionGuid,
    interactionGuid: schema.interactionGuid,
    nonce: createRockConnectionNonce(),
    campuses: schema.campuses.map(({ value }) => value),
    selectedCampusId: schema.selectedCampusId,
    displayHomePhone: schema.displayHomePhone,
    displayMobilePhone: schema.displayMobilePhone,
    attributes: schema.attributes.map(({ attributeGuid, fieldTypeGuid, key, isRequired, configurationValues }) => ({
      attributeGuid,
      fieldTypeGuid,
      key,
      isRequired,
      configurationValues,
    })),
    issuedAt: now,
    expiresAt: now + 5 * 60_000,
  }
}

function schemasMatchContext(schema: RockConnectionSignupSchema, context: RockConnectionContext): boolean {
  const current = contextFromSchema(schema, context.issuedAt)
  return (
    current.pageGuid === context.pageGuid &&
    current.blockGuid === context.blockGuid &&
    current.opportunityGuid === context.opportunityGuid &&
    current.selectedCampusId === context.selectedCampusId &&
    current.displayHomePhone === context.displayHomePhone &&
    current.displayMobilePhone === context.displayMobilePhone &&
    JSON.stringify(current.campuses) === JSON.stringify(context.campuses) &&
    JSON.stringify(current.attributes) === JSON.stringify(context.attributes)
  )
}

function expectedHostname(request: NextRequest): string | null {
  return process.env.TURNSTILE_EXPECTED_HOSTNAME ||
    (process.env.NODE_ENV === 'production' ? request.nextUrl.hostname : null)
}

function logFailure(correlationId: string, operation: string, failure: string, startedAt: number) {
  console.error('rock_connection_signup_failure', {
    correlationId,
    operation,
    failure,
    durationMs: Date.now() - startedAt,
  })
}

async function protectRequest(
  request: NextRequest,
  body: Record<string, unknown>,
  routeClass: 'start' | 'submit',
  dependencies: RouteDependencies,
): Promise<string> {
  const address = trustedConnectionClientAddress(request.headers)
  await enforceConnectionRateLimit({ address, routeClass, store: dependencies.rateLimitStore })
  await verifyTurnstileToken({
    token: typeof body.turnstileToken === 'string' ? body.turnstileToken : '',
    remoteIp: address,
    expectedHostname: expectedHostname(request),
    expectedAction: routeClass === 'start' ? ROCK_CONNECTION_START_ACTION : ROCK_CONNECTION_SUBMIT_ACTION,
  })
  return address
}

export async function GET(_request: NextRequest, routeContext: RouteContext) {
  try {
    const { blockGuid } = await routeContext.params
    if (!GUID_PATTERN.test(blockGuid)) return errorResponse('Invalid signup identifier', 400)
    if (!(await isRockConnectionSignupPublished(blockGuid))) return errorResponse('This signup is not published on the website', 404)
    return response({ turnstileSiteKey: getTurnstileSiteKey() })
  } catch {
    return errorResponse('Unable to load this signup', 503)
  }
}

export async function handlePost(
  request: NextRequest,
  routeContext: RouteContext,
  dependencies: RouteDependencies = {
    nonceStore: createPostgresNonceStore(),
    rateLimitStore: createPostgresRateLimitStore(),
  },
) {
  const correlationId = randomUUID()
  const startedAt = Date.now()
  let operation: 'unknown' | 'start' | 'submit' = 'unknown'
  try {
    if (!isSameOriginRequest(request)) return errorResponse('Invalid request origin', 403)
    const { blockGuid: rawBlockGuid } = await routeContext.params
    if (!GUID_PATTERN.test(rawBlockGuid)) return errorResponse('Invalid signup identifier', 400)
    const blockGuid = rawBlockGuid.toLowerCase()
    const body = await boundedJson(request)
    operation = body.intent === 'submit' ? 'submit' : body.intent === 'start' ? 'start' : 'unknown'
    if (operation === 'unknown') return errorResponse('Invalid request', 400)

    await protectRequest(request, body, operation, dependencies)
    if (!(await isRockConnectionSignupPublished(blockGuid))) return errorResponse('This signup is not published on the website', 404)

    if (operation === 'start') {
      if (Object.keys(body).some((key) => !['intent', 'turnstileToken'].includes(key))) return errorResponse('Invalid request', 400)
      const schema = await initializeRockConnectionSignup(blockGuid)
      const context = contextFromSchema(schema, Date.now())
      await dependencies.nonceStore.create({
        nonceDigest: digestConnectionNonce(context.nonce),
        purpose: context.purpose,
        pageGuid: context.pageGuid,
        blockGuid: context.blockGuid,
        expiresAt: new Date(context.expiresAt),
      })
      return response({
        schema: {
          ...schema,
          sessionGuid: undefined,
          interactionGuid: undefined,
        },
        contextToken: createRockConnectionContextToken(context),
      })
    }

    if (Object.keys(body).some((key) => !['intent', 'turnstileToken', 'contextToken', 'values'].includes(key))) return errorResponse('Invalid request', 400)
    if (typeof body.contextToken !== 'string') return errorResponse('Invalid connection context', 400)
    const signedContext = verifyRockConnectionContextToken(body.contextToken)
    if (signedContext.blockGuid !== blockGuid) return errorResponse('Invalid connection context', 400)

    const currentSchema = await initializeRockConnectionSignup(blockGuid)
    if (!schemasMatchContext(currentSchema, signedContext)) return errorResponse('This signup configuration changed; please reload', 409)
    const bag = validateRockConnectionSubmission(body.values, signedContext)
    const nonceRecord = {
      nonceDigest: digestConnectionNonce(signedContext.nonce),
      purpose: signedContext.purpose,
      pageGuid: signedContext.pageGuid,
      blockGuid: signedContext.blockGuid,
      expiresAt: new Date(signedContext.expiresAt),
    }
    if (!(await dependencies.nonceStore.consume(nonceRecord))) return errorResponse('This signup has expired or was already submitted', 409)

    const result = await sendRockConnectionSignup({
      pageGuid: signedContext.pageGuid,
      blockGuid: signedContext.blockGuid,
      sessionGuid: signedContext.sessionGuid,
      interactionGuid: signedContext.interactionGuid,
      bag,
    })
    if (result.resultType !== 0) {
      logFailure(correlationId, operation, 'rock_rejected', startedAt)
      return errorResponse('Unable to submit this signup right now', 502)
    }
    return response({
      status: 'complete',
      resultType: result.resultType,
      message: sanitizeRockResponseMessage(result.responseMessage),
    })
  } catch (error) {
    if (error instanceof ConnectionRateLimitError) {
      return errorResponse('Too many requests', 429, { 'Retry-After': String(error.retryAfterSeconds) })
    }
    if (error instanceof RockConnectionSignupOutcomeUnknownError) {
      logFailure(correlationId, operation, 'outcome_unknown', startedAt)
      return response({ error: 'The submission outcome could not be confirmed', outcomeUnknown: true }, 504)
    }
    const message = error instanceof Error ? error.message : ''
    if (SAFE_TURNSTILE_ERRORS.has(message)) return errorResponse(message, 400)
    if (['Invalid request', 'Invalid connection context', 'Invalid submission'].includes(message)) return errorResponse(message, 400)
    logFailure(correlationId, operation, 'service_unavailable', startedAt)
    return errorResponse('Unable to process this signup right now', 503)
  }
}

export async function POST(request: NextRequest, routeContext: RouteContext) {
  return handlePost(request, routeContext)
}
