import type {
  BlinkPayAccessToken,
  BlinkPayAmount,
  BlinkPayConfig,
  BlinkPayConsent,
  BlinkPayFixedRecurringPayment,
  BlinkPayMutationResult,
  BlinkPayOperationMetadata,
  BlinkPayOperationKeys,
  BlinkPayPayment,
  BlinkPayPcr,
  BlinkPayQuickPayment,
  CreateEnduringConsentRequest,
  CreateEnduringConsentResponse,
  CreateFixedRecurringPaymentRequest,
  CreateFixedRecurringPaymentResponse,
  CreateQuickPaymentRequest,
  CreateQuickPaymentResponse,
} from './types'
import {
  assertCallbackUri,
  assertConsentFromTimestamp,
  assertFixedRecurringPaymentInput,
  assertRedirectUri,
  minorUnitsToNzd,
  validateIsoTimestamp,
  validateNzDate,
  validatePcr,
  validatePeriod,
} from './validation'

const MAX_RESPONSE_BYTES = 64 * 1024
const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_GET_RETRIES = 1
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const AMOUNT_PATTERN = /^(?:0\.(?:0[1-9]|[1-9]\d)|[1-9]\d*\.\d{2})$/u

export type BlinkPayClientErrorCode =
  | 'configuration-invalid'
  | 'request-rejected'
  | 'request-unavailable'
  | 'response-invalid'

export class BlinkPayClientError extends Error {
  constructor(
    public readonly code: BlinkPayClientErrorCode,
    public readonly status?: number,
    public readonly metadata?: BlinkPayOperationMetadata,
  ) {
    super(`BlinkPay request failed: ${code}`)
    this.name = 'BlinkPayClientError'
  }
}

export interface CreateBlinkPayClientOptions {
  config: Readonly<BlinkPayConfig>
  fetchImpl?: typeof fetch
  now?: () => Date
  sleep?: (ms: number) => Promise<void>
  uuid?: () => string
  timeoutMs?: number
  getRetries?: number
  retryDelayMs?: number
}

interface RequestContext {
  requestId: string
  idempotencyKey: string
  tokenScope?: string
}

const OPERATION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u

interface RequestResult {
  response: Response
  context: RequestContext
  correlationId?: string
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) throw new BlinkPayClientError('response-invalid')
  return value
}

function requiredUuid(value: unknown) {
  const id = requiredString(value)
  if (!UUID_PATTERN.test(id)) throw new BlinkPayClientError('response-invalid')
  return id
}

function parseAmount(value: unknown): BlinkPayAmount {
  if (!record(value) || value.currency !== 'NZD' || typeof value.total !== 'string' || !AMOUNT_PATTERN.test(value.total)) {
    throw new BlinkPayClientError('response-invalid')
  }
  return { total: value.total, currency: 'NZD' }
}

function assertAmount(value: BlinkPayAmount) {
  parseAmount(value)
  return value
}

function parsePcr(value: unknown): BlinkPayPcr {
  if (!record(value)) throw new BlinkPayClientError('response-invalid')
  try {
    return validatePcr({
      particulars: requiredString(value.particulars),
      ...(value.code === undefined ? {} : { code: requiredString(value.code) }),
      ...(value.reference === undefined ? {} : { reference: requiredString(value.reference) }),
    })
  } catch {
    throw new BlinkPayClientError('response-invalid')
  }
}

function parseTimestamp(value: unknown, optional = false) {
  if (value === undefined && optional) return undefined
  try {
    return validateIsoTimestamp(requiredString(value))
  } catch {
    throw new BlinkPayClientError('response-invalid')
  }
}

function parsePayment(value: unknown): BlinkPayPayment {
  if (!record(value) || !record(value.detail) || !Array.isArray(value.refunds)) throw new BlinkPayClientError('response-invalid')
  return {
    payment_id: requiredUuid(value.payment_id),
    type: requiredString(value.type),
    status: requiredString(value.status),
    ...(value.accepted_reason === undefined ? {} : { accepted_reason: requiredString(value.accepted_reason) }),
    creation_timestamp: parseTimestamp(value.creation_timestamp)!,
    status_updated_timestamp: parseTimestamp(value.status_updated_timestamp)!,
    detail: value.detail,
    refunds: value.refunds,
  }
}

function parseConsent(value: unknown): BlinkPayConsent {
  if (!record(value) || !record(value.detail) || !Array.isArray(value.payments)) throw new BlinkPayClientError('response-invalid')
  return {
    consent_id: requiredUuid(value.consent_id),
    status: requiredString(value.status),
    creation_timestamp: parseTimestamp(value.creation_timestamp)!,
    status_updated_timestamp: parseTimestamp(value.status_updated_timestamp)!,
    detail: value.detail,
    payments: value.payments.map(parsePayment),
  }
}

function parseQuickPayment(value: unknown): BlinkPayQuickPayment {
  if (!record(value)) throw new BlinkPayClientError('response-invalid')
  return { quick_payment_id: requiredUuid(value.quick_payment_id), consent: parseConsent(value.consent) }
}

function parseFixedRecurringPayment(value: unknown): BlinkPayFixedRecurringPayment {
  if (!record(value)) throw new BlinkPayClientError('response-invalid')
  const retryStrategy = requiredString(value.retry_strategy)
  if (retryStrategy !== 'none' && retryStrategy !== 'same_day') throw new BlinkPayClientError('response-invalid')
  let startDate: string
  let nextPaymentDate: string
  try {
    startDate = validateNzDate(requiredString(value.start_date))
    nextPaymentDate = validateNzDate(requiredString(value.next_payment_date))
  } catch {
    throw new BlinkPayClientError('response-invalid')
  }
  return {
    fixed_recurring_payment_id: requiredUuid(value.fixed_recurring_payment_id),
    consent_id: requiredUuid(value.consent_id),
    status: requiredString(value.status),
    start_date: startDate,
    next_payment_date: nextPaymentDate,
    amount: parseAmount(value.amount),
    pcr: parsePcr(value.pcr),
    retry_strategy: retryStrategy,
    creation_timestamp: parseTimestamp(value.creation_timestamp)!,
    ...(value.status_updated_timestamp === undefined ? {} : { status_updated_timestamp: parseTimestamp(value.status_updated_timestamp, true) }),
  }
}

function metadata(context: RequestContext, correlationId?: string): BlinkPayOperationMetadata {
  return {
    requestId: context.requestId,
    idempotencyKey: context.idempotencyKey,
    ...(correlationId ? { correlationId } : {}),
    ...(context.tokenScope ? { tokenScope: context.tokenScope } : {}),
  }
}

function transientNetwork(error: unknown) {
  return error instanceof TypeError || (error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name))
}

async function discardBody(response: Response) {
  try { await response.body?.cancel() } catch { /* best-effort resource release */ }
}

async function boundedJson(response: Response) {
  const mediaType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (mediaType !== 'application/json') { await discardBody(response); throw new BlinkPayClientError('response-invalid') }
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) { await discardBody(response); throw new BlinkPayClientError('response-invalid') }
  const text = await response.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) throw new BlinkPayClientError('response-invalid')
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new BlinkPayClientError('response-invalid')
  }
}

export function createBlinkPayClient(options: CreateBlinkPayClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? (() => new Date())
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  const uuid = options.uuid ?? crypto.randomUUID
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const getRetries = options.getRetries ?? DEFAULT_GET_RETRIES
  const retryDelayMs = options.retryDelayMs ?? 100
  const baseUrl = new URL(options.config.apiBaseUrl)

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || !Number.isInteger(getRetries) || getRetries < 0 || getRetries > 3 || retryDelayMs < 0) {
    throw new BlinkPayClientError('configuration-invalid')
  }

  let token: BlinkPayAccessToken | undefined
  let tokenFlight: Promise<BlinkPayAccessToken> | undefined

  async function fetchToken(force = false): Promise<BlinkPayAccessToken> {
    const nowMs = now().getTime()
    if (!force && token && token.expiresAtMs - TOKEN_REFRESH_BUFFER_MS > nowMs) return token
    if (tokenFlight) return tokenFlight
    tokenFlight = (async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        let response: Response
        try {
          response = await fetchImpl(options.config.oauthTokenUrl, {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'client_credentials',
              client_id: options.config.clientId,
              client_secret: options.config.clientSecret,
            }).toString(),
            redirect: 'error',
            cache: 'no-store',
            signal: AbortSignal.timeout(timeoutMs),
          })
        } catch (error) {
          if (transientNetwork(error) && attempt < 2) {
            await sleep(retryDelayMs * (attempt + 1))
            continue
          }
          throw new BlinkPayClientError('request-unavailable')
        }
        if (response.redirected) { await discardBody(response); throw new BlinkPayClientError('request-rejected', response.status) }
        if (response.status >= 500 && attempt < 2) {
          await discardBody(response)
          await sleep(retryDelayMs * (attempt + 1))
          continue
        }
        if (!response.ok) {
          await discardBody(response)
          throw new BlinkPayClientError(response.status >= 500 ? 'request-unavailable' : 'request-rejected', response.status)
        }
        const value = await boundedJson(response)
        if (!record(value) || typeof value.access_token !== 'string' || value.access_token.length === 0 || value.token_type !== 'Bearer' || !Number.isSafeInteger(value.expires_in) || Number(value.expires_in) <= 0 || (value.scope !== undefined && typeof value.scope !== 'string')) {
          throw new BlinkPayClientError('response-invalid')
        }
        token = {
          accessToken: value.access_token,
          tokenType: 'Bearer',
          expiresAtMs: now().getTime() + Number(value.expires_in) * 1000,
          ...(typeof value.scope === 'string' ? { scope: value.scope } : {}),
        }
        return token
      }
      throw new BlinkPayClientError('request-unavailable')
    })()
    try {
      return await tokenFlight
    } finally {
      tokenFlight = undefined
    }
  }

  function operationContext(): RequestContext {
    return { requestId: uuid(), idempotencyKey: uuid() }
  }

  function callerOperationContext(keys: BlinkPayOperationKeys): RequestContext {
    if (!OPERATION_KEY_PATTERN.test(keys.requestId) || !OPERATION_KEY_PATTERN.test(keys.idempotencyKey)) {
      throw new BlinkPayClientError('configuration-invalid')
    }
    return { requestId: keys.requestId, idempotencyKey: keys.idempotencyKey }
  }

  async function request(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    body: unknown,
    context: RequestContext,
  ): Promise<RequestResult> {
    const url = new URL(endpoint, baseUrl)
    if (url.origin !== baseUrl.origin || !url.pathname.startsWith(baseUrl.pathname)) throw new BlinkPayClientError('configuration-invalid')
    const maxAttempts = method === 'GET' ? getRetries + 1 : 1
    let refreshed = false

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const access = await fetchToken(refreshed)
      context.tokenScope = access.scope
      let response: Response
      try {
        response = await fetchImpl(url, {
          method,
          headers: {
            Authorization: `${access.tokenType} ${access.accessToken}`,
            Accept: 'application/json',
            'request-id': context.requestId,
            'idempotency-key': context.idempotencyKey,
            'x-correlation-id': uuid(),
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch (error) {
        if (method === 'GET' && transientNetwork(error) && attempt + 1 < maxAttempts) {
          await sleep(retryDelayMs * (attempt + 1))
          continue
        }
        throw error
      }
      const correlationId = response.headers.get('x-correlation-id') ?? undefined
      if (response.redirected) { await discardBody(response); throw new BlinkPayClientError('request-rejected', response.status, metadata(context, correlationId)) }
      if (response.status === 401 && !refreshed) {
        await discardBody(response)
        refreshed = true
        token = undefined
        attempt -= 1
        continue
      }
      if (method === 'GET' && (response.status === 429 || response.status >= 500) && attempt + 1 < maxAttempts) {
        await discardBody(response)
        await sleep(retryDelayMs * (attempt + 1))
        continue
      }
      return { response, context, ...(correlationId ? { correlationId } : {}) }
    }
    throw new BlinkPayClientError('request-unavailable', undefined, metadata(context))
  }

  async function read<T>(endpoint: string, parse: (value: unknown) => T): Promise<T> {
    const context = operationContext()
    let result: RequestResult
    try {
      result = await request('GET', endpoint, undefined, context)
    } catch (error) {
      if (error instanceof BlinkPayClientError) throw error
      throw new BlinkPayClientError('request-unavailable', undefined, metadata(context))
    }
    if (!result.response.ok) {
      await discardBody(result.response)
      throw new BlinkPayClientError(
        result.response.status === 429 || result.response.status >= 500 ? 'request-unavailable' : 'request-rejected',
        result.response.status,
        metadata(context, result.correlationId),
      )
    }
    let value: T
    try {
      value = parse(await boundedJson(result.response))
    } catch {
      throw new BlinkPayClientError('response-invalid', result.response.status, metadata(context, result.correlationId))
    }
    if (record(value) && result.correlationId) {
      Object.defineProperty(value, 'provider_correlation_id', { value: result.correlationId, enumerable: false })
    }
    return value
  }

  async function create<T>(endpoint: string, body: unknown, keys: BlinkPayOperationKeys, parse: (value: unknown) => T): Promise<BlinkPayMutationResult<T>> {
    const context = callerOperationContext(keys)
    let result: RequestResult
    try {
      result = await request('POST', endpoint, body, context)
    } catch (error) {
      if (error instanceof BlinkPayClientError) throw error
      return { outcome: 'unknown', reason: 'request-ambiguous', metadata: metadata(context) }
    }
    const requestMetadata = metadata(context, result.correlationId)
    if (result.response.status >= 500) { await discardBody(result.response); return { outcome: 'unknown', reason: 'request-ambiguous', metadata: requestMetadata } }
    if (!result.response.ok) { await discardBody(result.response); throw new BlinkPayClientError('request-rejected', result.response.status, requestMetadata) }
    try {
      return { outcome: 'succeeded', value: parse(await boundedJson(result.response)), metadata: requestMetadata }
    } catch {
      return { outcome: 'unknown', reason: 'response-invalid', metadata: requestMetadata }
    }
  }

  function createQuickPayment(input: CreateQuickPaymentRequest, keys: BlinkPayOperationKeys) {
    assertCallbackUri(input.flow.detail.redirect_uri, options.config.callbackOrigin)
    assertAmount(input.amount)
    validatePcr(input.pcr)
    return create<CreateQuickPaymentResponse>('quick-payments', input, keys, (value) => {
      if (!record(value)) throw new BlinkPayClientError('response-invalid')
      const redirectUri = requiredString(value.redirect_uri)
      return {
        quick_payment_id: requiredUuid(value.quick_payment_id),
        redirect_uri: assertRedirectUri(redirectUri, options.config.gatewayOrigins),
      }
    })
  }

  function createEnduringConsent(input: CreateEnduringConsentRequest, keys: BlinkPayOperationKeys) {
    assertCallbackUri(input.flow.detail.redirect_uri, options.config.callbackOrigin)
    const requestNow = now()
    const fromTimestamp = assertConsentFromTimestamp(input.from_timestamp, requestNow)
    if (input.expiry_timestamp) {
      const expiryTimestamp = validateIsoTimestamp(input.expiry_timestamp)
      const expiryMs = Date.parse(expiryTimestamp)
      if (expiryMs <= requestNow.getTime() || expiryMs <= Date.parse(fromTimestamp)) {
        throw new BlinkPayClientError('configuration-invalid')
      }
    }
    validatePeriod(input.period)
    assertAmount(input.maximum_amount_period)
    assertAmount(input.maximum_amount_payment)
    const amountMinor = (value: BlinkPayAmount) => {
      const [whole, cents] = value.total.split('.')
      return BigInt(whole!) * 100n + BigInt(cents!)
    }
    if (amountMinor(input.maximum_amount_payment) > amountMinor(input.maximum_amount_period)) {
      throw new BlinkPayClientError('configuration-invalid')
    }
    return create<CreateEnduringConsentResponse>('enduring-consents', input, keys, (value) => {
      if (!record(value)) throw new BlinkPayClientError('response-invalid')
      const redirectUri = requiredString(value.redirect_uri)
      return {
        consent_id: requiredUuid(value.consent_id),
        redirect_uri: assertRedirectUri(redirectUri, options.config.gatewayOrigins),
      }
    })
  }

  function createFixedRecurringPayment(input: CreateFixedRecurringPaymentRequest, keys: BlinkPayOperationKeys) {
    requiredUuid(input.consent_id)
    assertAmount(input.amount)
    validatePcr(input.pcr)
    if (input.retry_strategy !== undefined && input.retry_strategy !== 'none' && input.retry_strategy !== 'same_day') {
      throw new BlinkPayClientError('configuration-invalid')
    }
    assertFixedRecurringPaymentInput({
      consentStatus: input.consent_status,
      period: input.period,
      startDate: input.start_date,
      amountMinor: input.amount_minor,
      maximumAmountPaymentMinor: input.maximum_amount_payment_minor,
      maximumAmountPeriodMinor: input.maximum_amount_period_minor,
    }, now())
    if (minorUnitsToNzd(input.amount_minor) !== input.amount.total) {
      throw new BlinkPayClientError('configuration-invalid')
    }
    const {
      consent_status: _consentStatus,
      period: _period,
      amount_minor: _amountMinor,
      maximum_amount_payment_minor: _maximumAmountPaymentMinor,
      maximum_amount_period_minor: _maximumAmountPeriodMinor,
      ...body
    } = input
    return create<CreateFixedRecurringPaymentResponse>('fixed-recurring-payments', body, keys, (value) => {
      if (!record(value)) throw new BlinkPayClientError('response-invalid')
      return { fixed_recurring_payment_id: requiredUuid(value.fixed_recurring_payment_id) }
    })
  }

  async function cancelFixedRecurringPayment(fixedRecurringPaymentId: string, keys: BlinkPayOperationKeys): Promise<BlinkPayMutationResult<undefined>> {
    requiredUuid(fixedRecurringPaymentId)
    const context = callerOperationContext(keys)
    let result: RequestResult
    try {
      result = await request('DELETE', `fixed-recurring-payments/${fixedRecurringPaymentId}`, undefined, context)
    } catch (error) {
      if (error instanceof BlinkPayClientError) throw error
      return { outcome: 'unknown', reason: 'request-ambiguous', metadata: metadata(context) }
    }
    const requestMetadata = metadata(context, result.correlationId)
    if (result.response.status >= 500) { await discardBody(result.response); return { outcome: 'unknown', reason: 'request-ambiguous', metadata: requestMetadata } }
    if (result.response.status !== 204) { await discardBody(result.response); throw new BlinkPayClientError('request-rejected', result.response.status, requestMetadata) }
    return { outcome: 'succeeded', value: undefined, metadata: requestMetadata }
  }

  return Object.freeze({
    createQuickPayment,
    getQuickPayment: (id: string) => { requiredUuid(id); return read(`quick-payments/${id}`, parseQuickPayment) },
    createEnduringConsent,
    getEnduringConsent: (id: string) => { requiredUuid(id); return read(`enduring-consents/${id}`, parseConsent) },
    getPayment: (id: string) => { requiredUuid(id); return read(`payments/${id}`, parsePayment) },
    createFixedRecurringPayment,
    getFixedRecurringPayment: (id: string) => { requiredUuid(id); return read(`fixed-recurring-payments/${id}`, parseFixedRecurringPayment) },
    cancelFixedRecurringPayment,
    isPaymentSettled: (payment: Pick<BlinkPayPayment, 'status'>) => payment.status === 'AcceptedSettlementCompleted',
    isConsentAuthorised: (consent: Pick<BlinkPayConsent, 'status'>) => consent.status === 'Authorised',
    isFixedRecurringPaymentActive: (schedule: Pick<BlinkPayFixedRecurringPayment, 'status'>) => schedule.status === 'active',
  })
}
