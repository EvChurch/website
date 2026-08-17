import { NextRequest, NextResponse } from 'next/server'

import { getBlinkPayRuntimeClient } from '@/lib/giving/blinkpay/runtime-client'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import { GIVING_PRIVATE_HEADERS } from '@/lib/giving/request-boundary'
import { createGivingCheckoutService, createPostgresGivingCheckoutRepository } from '@/lib/giving/service'
import { getPayloadClient } from '@/lib/payload'

export const dynamic = 'force-dynamic'

export interface GivingReturnDependencies {
  consume(token: string, expectedProviderId: string | null): Promise<{ statusToken: string; checkoutId: number }>
}

function unavailable() {
  return new NextResponse('Not found', { status: 404, headers: GIVING_PRIVATE_HEADERS })
}

function callbackAlias(url: URL): string | false {
  if (url.searchParams.size === 0) return false
  if (url.searchParams.size !== 1) return false
  const [key, value] = url.searchParams.entries().next().value!
  return ['cid', 'consent_id'].includes(key) && value.length > 0 && value.length <= 128 ? value : false
}

async function defaultConsume(token: string, expectedProviderId: string | null) {
  const payload = await getPayloadClient()
  const pool = requireGivingPostgresPool(payload)
  const noIdentity = async () => { throw new Error('Identity unavailable') }
  const service = createGivingCheckoutService({
    repository: createPostgresGivingCheckoutRepository(pool),
    digestSecret: process.env.GIVING_CHECKOUT_DIGEST_SECRET ?? '',
    resolveIdentity: noIdentity,
    blinkPay: getBlinkPayRuntimeClient,
  })
  return service.consumeReturn(token, expectedProviderId)
}

export async function handleGivingReturnGet(
  request: NextRequest,
  dependencies: GivingReturnDependencies = { consume: defaultConsume },
) {
  try {
    const alias = callbackAlias(request.nextUrl)
    if (alias === false) return unavailable()
    const token = request.cookies.get('__Host-ev_giving_return')?.value
    if (!token) return unavailable()
    const result = await dependencies.consume(token, alias)
    const response = NextResponse.redirect(new URL('/?giving=return', request.url), 303)
    for (const [key, value] of Object.entries(GIVING_PRIVATE_HEADERS)) response.headers.set(key, value)
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
