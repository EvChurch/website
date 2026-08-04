import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

import { getTurnstileSiteKey } from '@/lib/rock-forms/config'
import { isGuid } from '@/lib/rock-forms/constants'
import {
  verifyRockConnectionContextToken,
  type RockConnectionContext,
} from '@/lib/rock-connection-signups/context-token'
import {
  ROCK_CONNECTION_START_ACTION,
  ROCK_CONNECTION_SUBMIT_ACTION,
} from '@/lib/rock-connection-signups/constants'
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
  connectionContextClaimsFromSchema,
  startRockConnectionSignup,
} from '@/lib/rock-connection-signups/start'
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
import {
  TurnstileVerificationError,
  verifyTurnstileToken,
} from '@/lib/turnstile'

export { ROCK_CONNECTION_START_ACTION, ROCK_CONNECTION_SUBMIT_ACTION }

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' }
const MAX_REQUEST_BYTES = 128_000

type RouteContext = { params: Promise<{ blockGuid: string }> }
type RouteDependencies = {
  nonceStore: ConnectionNonceStore
  rateLimitStore: ConnectionRateLimitStore
}

function response(value: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(value, { status, headers: { ...NO_STORE, ...headers } })
}

function errorResponse(
  message: string,
  status: number,
  headers?: Record<string, string>,
  details?: Record<string, unknown>,
) {
  return response({ error: message, ...details }, status, headers)
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

function schemasMatchContext(schema: RockConnectionSignupSchema, context: RockConnectionContext): boolean {
  const current = connectionContextClaimsFromSchema(schema)
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
): Promise<void> {
  const address = trustedConnectionClientAddress(request.headers)
  await enforceConnectionRateLimit({ address, routeClass, store: dependencies.rateLimitStore })
  await verifyTurnstileToken({
    token: typeof body.turnstileToken === 'string' ? body.turnstileToken : '',
    remoteIp: address,
    expectedHostname: expectedHostname(request),
    expectedAction: routeClass === 'start' ? ROCK_CONNECTION_START_ACTION : ROCK_CONNECTION_SUBMIT_ACTION,
  })
}

export async function handleGet(_request: NextRequest, routeContext: RouteContext) {
  try {
    const { blockGuid } = await routeContext.params
    if (!isGuid(blockGuid)) return errorResponse('Invalid signup identifier', 400)
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
  const failureResponse = (
    failure: string,
    message: string,
    status: number,
    headers?: Record<string, string>,
    restartRequired = false,
  ) => {
    logFailure(correlationId, operation, failure, startedAt)
    return errorResponse(
      message,
      status,
      headers,
      restartRequired ? { restartRequired: true } : undefined,
    )
  }
  try {
    if (!isSameOriginRequest(request)) return failureResponse('origin_invalid', 'Invalid request origin', 403)
    const { blockGuid: rawBlockGuid } = await routeContext.params
    if (!isGuid(rawBlockGuid)) return failureResponse('identifier_invalid', 'Invalid signup identifier', 400)
    const blockGuid = rawBlockGuid.toLowerCase()
    const body = await boundedJson(request)
    operation = body.intent === 'submit' ? 'submit' : body.intent === 'start' ? 'start' : 'unknown'
    if (operation === 'unknown') return failureResponse('request_invalid', 'Invalid request', 400)

    await protectRequest(request, body, operation, dependencies)
    if (!(await isRockConnectionSignupPublished(blockGuid))) return failureResponse('not_published', 'This signup is not published on the website', 404)

    if (operation === 'start') {
      if (Object.keys(body).some((key) => !['intent', 'turnstileToken'].includes(key))) return failureResponse('request_invalid', 'Invalid request', 400)
      return response(
        await startRockConnectionSignup({
          blockGuid,
          nonceStore: dependencies.nonceStore,
        }),
      )
    }

    if (Object.keys(body).some((key) => !['intent', 'turnstileToken', 'contextToken', 'values'].includes(key))) return failureResponse('request_invalid', 'Invalid request', 400)
    if (typeof body.contextToken !== 'string') return failureResponse('context_invalid', 'Invalid connection context', 400, undefined, true)
    const signedContext = verifyRockConnectionContextToken(body.contextToken)
    if (signedContext.blockGuid !== blockGuid) return failureResponse('context_invalid', 'Invalid connection context', 400, undefined, true)

    const currentSchema = await initializeRockConnectionSignup(blockGuid)
    if (!schemasMatchContext(currentSchema, signedContext)) return failureResponse('configuration_changed', 'This signup configuration changed; please try again', 409, undefined, true)
    const bag = validateRockConnectionSubmission(body.values, signedContext)
    const nonceRecord = {
      nonceDigest: digestConnectionNonce(signedContext.nonce),
      purpose: signedContext.purpose,
      pageGuid: signedContext.pageGuid,
      blockGuid: signedContext.blockGuid,
      expiresAt: new Date(signedContext.expiresAt),
    }
    if (!(await dependencies.nonceStore.consume(nonceRecord))) return failureResponse('nonce_rejected', 'This signup has expired or was already submitted', 409, undefined, true)

    const result = await sendRockConnectionSignup({
      pageGuid: signedContext.pageGuid,
      blockGuid: signedContext.blockGuid,
      sessionGuid: signedContext.sessionGuid,
      interactionGuid: signedContext.interactionGuid,
      bag,
    })
    if (result.resultType !== 0) {
      return failureResponse('rock_rejected', 'Unable to submit this signup right now', 502, undefined, true)
    }
    return response({
      status: 'complete',
      resultType: result.resultType,
      message: sanitizeRockResponseMessage(result.responseMessage),
    })
  } catch (error) {
    if (error instanceof ConnectionRateLimitError) {
      return failureResponse('rate_limited', 'Too many requests', 429, { 'Retry-After': String(error.retryAfterSeconds) })
    }
    if (error instanceof RockConnectionSignupOutcomeUnknownError) {
      logFailure(correlationId, operation, 'outcome_unknown', startedAt)
      return response({ error: 'The submission outcome could not be confirmed', outcomeUnknown: true }, 504)
    }
    const message = error instanceof Error ? error.message : ''
    if (error instanceof TurnstileVerificationError) return failureResponse('turnstile_rejected', error.message, 400)
    if (['Invalid request', 'Invalid connection context', 'Invalid submission'].includes(message)) {
      const failure = message === 'Invalid connection context' ? 'context_invalid' : 'request_invalid'
      return failureResponse(
        failure,
        message,
        400,
        undefined,
        message === 'Invalid connection context',
      )
    }
    logFailure(correlationId, operation, 'service_unavailable', startedAt)
    return errorResponse('Unable to process this signup right now', 503)
  }
}
