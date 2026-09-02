import { NextRequest, NextResponse } from 'next/server'

import { getBlinkPayRuntimeClient } from '@/lib/giving/blinkpay/runtime-client'
import { isGivingCapabilityToken } from '@/lib/giving/contracts'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import { GIVING_PRIVATE_HEADERS } from '@/lib/giving/request-boundary'
import { createGivingCheckoutService, createPostgresGivingCheckoutRepository } from '@/lib/giving/service'
import { getPayloadClient } from '@/lib/payload'

export const dynamic = 'force-dynamic'

export interface GivingReturnDependencies {
  consume(token: string, expectedProviderId: string | null): Promise<{ statusToken: string; checkoutId: number }>
  validateStatus(token: string): Promise<void>
  completionUrl?(): URL
}

function unavailable() {
  return new NextResponse('Not found', { status: 404, headers: GIVING_PRIVATE_HEADERS })
}

function givingCompletionUrl() {
  const configured = process.env.APP_BASE_URL
  if (!configured) throw new Error('APP_BASE_URL is required')
  const base = new URL(configured)
  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(base.hostname)
  if (base.origin !== configured || base.username || base.password || base.pathname !== '/' || base.search || base.hash) {
    throw new Error('APP_BASE_URL must be an origin')
  }
  if (base.protocol !== 'https:' && !(base.protocol === 'http:' && isLoopback)) {
    throw new Error('APP_BASE_URL must use HTTPS outside local development')
  }
  return new URL('/?giving=return', base)
}

function completionRedirect(completionUrl: URL) {
  const response = NextResponse.redirect(completionUrl, 303)
  for (const [key, value] of Object.entries(GIVING_PRIVATE_HEADERS)) response.headers.set(key, value)
  return response
}

function callbackAlias(url: URL): true | false {
  if (url.searchParams.size === 0) return false
  const cid = url.searchParams.getAll('cid')
  const consentId = url.searchParams.getAll('consent_id')
  const errors = url.searchParams.getAll('error')
  if (cid.length + consentId.length !== 1) return false
  if (errors.length > 1) return false
  for (const key of url.searchParams.keys()) {
    if (!['cid', 'consent_id', 'error'].includes(key)) return false
  }
  const value = cid[0] ?? consentId[0] ?? ''
  const error = errors[0] ?? null
  return value.length > 0 && value.length <= 128 && (error === null || error.length <= 512) ? true : false
}

async function givingService() {
  const payload = await getPayloadClient()
  const pool = requireGivingPostgresPool(payload)
  const noIdentity = async () => { throw new Error('Identity unavailable') }
  return createGivingCheckoutService({
    repository: createPostgresGivingCheckoutRepository(pool),
    digestSecret: process.env.GIVING_CHECKOUT_DIGEST_SECRET ?? '',
    resolveIdentity: noIdentity,
    blinkPay: getBlinkPayRuntimeClient,
  })
}

async function defaultConsume(token: string, expectedProviderId: string | null) {
  return (await givingService()).consumeReturn(token, expectedProviderId)
}

async function defaultValidateStatus(token: string) {
  await (await givingService()).status(token)
}

export async function handleGivingReturnGet(
  request: NextRequest,
  dependencies: GivingReturnDependencies = { consume: defaultConsume, validateStatus: defaultValidateStatus },
) {
  try {
    const alias = callbackAlias(request.nextUrl)
    if (alias === false) return unavailable()
    const completionUrl = dependencies.completionUrl?.() ?? givingCompletionUrl()
    const statusToken = request.cookies.get('__Host-ev_giving_checkout')?.value
    if (statusToken && isGivingCapabilityToken(statusToken)) {
      try {
        await dependencies.validateStatus(statusToken)
        return completionRedirect(completionUrl)
      } catch {
        // A stale status capability can still accompany the first provider return.
      }
    }
    const token = request.cookies.get('__Host-ev_giving_return')?.value
    if (!token) return unavailable()
    const result = await dependencies.consume(token, null)
    const response = completionRedirect(completionUrl)
    response.cookies.set('__Host-ev_giving_checkout', result.statusToken, {
      httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 30 * 60,
    })
    response.cookies.set('__Host-ev_giving_return', '', {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0,
    })
    return response
  } catch {
    return unavailable()
  }
}

export async function GET(request: NextRequest) {
  return handleGivingReturnGet(request)
}
