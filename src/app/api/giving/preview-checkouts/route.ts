import { createHash } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import { createBlinkPayClient } from '@/lib/giving/blinkpay/client'
import { givingBankCode } from '@/lib/giving/bank-transfer'
import { loadBlinkPayConfig } from '@/lib/giving/blinkpay/config'
import type { BlinkPayMutationResult, BlinkPayOperationKeys } from '@/lib/giving/blinkpay/types'
import { assertFixedRecurringPaymentInput, minorUnitsToNzd } from '@/lib/giving/blinkpay/validation'
import { validateGivingCheckoutSubmission, type GivingCheckoutSubmission } from '@/lib/giving/service'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 8_192
const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
}

type PreviewStartResult =
  | { outcome: 'redirect'; gatewayRedirectUri: string }
  | { outcome: 'unknown'; retryAllowed: false }

export interface GivingPreviewCheckoutDependencies {
  development: boolean
  start(submission: GivingCheckoutSubmission, callbackOrigin: string): Promise<PreviewStartResult>
}

function json(value: unknown, status: number) {
  return NextResponse.json(value, { status, headers: PRIVATE_HEADERS })
}

function trustedLocalRequest(request: NextRequest) {
  const url = request.nextUrl
  return url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
    request.headers.get('origin') === url.origin &&
    request.headers.get('sec-fetch-site') === 'same-origin' &&
    request.headers.get('x-ev-giving-request') === 'checkout-preview-v1' &&
    request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json'
}

async function readSubmission(request: NextRequest) {
  const declared = request.headers.get('content-length')
  if (declared && (!Number.isSafeInteger(Number(declared)) || Number(declared) < 0 || Number(declared) > MAX_BODY_BYTES)) throw new Error('invalid')
  const text = await request.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) throw new Error('invalid')
  return validateGivingCheckoutSubmission(JSON.parse(text) as unknown)
}

function assertPreviewSubmission(submission: GivingCheckoutSubmission) {
  if (submission.amountMinor < 100 || !['one-off', 'weekly', 'fortnightly', 'monthly'].includes(submission.frequency)) throw new Error('invalid')
  if (submission.frequency !== 'one-off') {
    assertFixedRecurringPaymentInput({
      consentStatus: 'Authorised',
      period: submission.frequency,
      startDate: submission.firstPaymentDate!,
      amountMinor: submission.amountMinor,
      maximumAmountPaymentMinor: submission.amountMinor,
      maximumAmountPeriodMinor: submission.amountMinor,
    })
  }
  return submission
}

export function previewOperationKeys(submission: GivingCheckoutSubmission): BlinkPayOperationKeys {
  const requestDigest = createHash('sha256').update(JSON.stringify({
    submissionKey: submission.submissionKey,
    amountMinor: submission.amountMinor,
    fundId: submission.fundId,
    frequency: submission.frequency,
    firstPaymentDate: submission.firstPaymentDate,
    bankCode: givingBankCode(submission.firstName, submission.lastName),
  })).digest('hex')
  const key = (purpose: string) => {
    const bytes = Buffer.from(createHash('sha256').update(`giving-preview-v1\0${purpose}\0${requestDigest}`).digest('hex').slice(0, 32), 'hex')
    bytes[6] = (bytes[6]! & 0x0f) | 0x40
    bytes[8] = (bytes[8]! & 0x3f) | 0x80
    const value = bytes.toString('hex')
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
  }
  return { requestId: key('request'), idempotencyKey: key('idempotency') }
}

async function startSandboxCheckout(submission: GivingCheckoutSubmission, callbackOrigin: string): Promise<PreviewStartResult> {
  const blinkPay = createBlinkPayClient({ config: { ...loadBlinkPayConfig('sandbox'), callbackOrigin } })
  const amount = { total: minorUnitsToNzd(submission.amountMinor), currency: 'NZD' as const }
  const redirectUri = `${callbackOrigin}/give/return`
  const keys = previewOperationKeys(submission)
  const result: BlinkPayMutationResult<{ redirect_uri: string }> = submission.frequency === 'one-off'
    ? await blinkPay.createQuickPayment({
        type: 'single',
        flow: { detail: { type: 'gateway', redirect_uri: redirectUri } },
        amount,
        pcr: { particulars: 'EV Giving', code: givingBankCode(submission.firstName, submission.lastName), reference: 'EVPREVIEW' },
      }, keys)
    : await blinkPay.createEnduringConsent({
        type: 'enduring',
        flow: { detail: { type: 'gateway', redirect_uri: redirectUri } },
        from_timestamp: new Date(Date.now() - 1_000).toISOString(),
        period: submission.frequency,
        maximum_amount_period: amount,
        maximum_amount_payment: amount,
      }, keys)

  return result.outcome === 'succeeded'
    ? { outcome: 'redirect', gatewayRedirectUri: result.value.redirect_uri }
    : { outcome: 'unknown', retryAllowed: false }
}

const defaults: GivingPreviewCheckoutDependencies = {
  development: process.env.NODE_ENV === 'development',
  start: startSandboxCheckout,
}

export async function handleGivingPreviewCheckoutPost(request: NextRequest, dependencies: GivingPreviewCheckoutDependencies = defaults) {
  if (!dependencies.development || !trustedLocalRequest(request)) return json({ error: 'Not found' }, 404)
  let submission: GivingCheckoutSubmission
  try {
    submission = assertPreviewSubmission(await readSubmission(request))
  } catch {
    return json({ error: 'Invalid preview checkout' }, 400)
  }
  try {
    const result = await dependencies.start(submission, request.nextUrl.origin)
    return result.outcome === 'redirect'
      ? json(result, 201)
      : json(result, 202)
  } catch {
    return json({ error: 'Sandbox checkout unavailable' }, 503)
  }
}

export async function POST(request: NextRequest) {
  return handleGivingPreviewCheckoutPost(request)
}
