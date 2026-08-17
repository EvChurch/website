import { NextRequest, NextResponse } from 'next/server'

import { getBlinkPayRuntimeClient } from '@/lib/giving/blinkpay/runtime-client'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import { createGivingCheckoutService, createPostgresGivingCheckoutRepository } from '@/lib/giving/service'
import { getPayloadClient } from '@/lib/payload'

export const dynamic = 'force-dynamic'
const HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
}
export interface GivingReturnDependencies {
  consume(token: string, expectedProviderId: string | null): Promise<{ statusToken: string; checkoutId: number }>
}
function unavailable() { return new NextResponse('Not found', { status: 404, headers: HEADERS }) }
function callbackAlias(url: URL): string | null | false {
  const entries = [...url.searchParams.entries()]
  if (entries.length === 0) return null
  if (entries.length !== 1) return false
  const [key, value] = entries[0]
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

export async function handleGivingReturnGet(request:NextRequest,context:{params:Promise<{token:string}>},dependencies:GivingReturnDependencies={consume:defaultConsume}){
  try {
    const alias = callbackAlias(request.nextUrl)
    if (alias === false) return unavailable()
    const { token } = await context.params
    const result = await dependencies.consume(token, alias)
    const response = NextResponse.redirect(new URL('/?giving=return', request.url), 303)
    for (const [key, value] of Object.entries(HEADERS)) response.headers.set(key, value)
    response.cookies.set('__Host-ev_giving_checkout', result.statusToken, {
      httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 30 * 60,
    })
    return response
  } catch {
    return unavailable()
  }
}
export async function GET(request:NextRequest,context:{params:Promise<{token:string}>}){return handleGivingReturnGet(request,context)}
