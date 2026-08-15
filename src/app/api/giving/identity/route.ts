import { NextResponse } from 'next/server'

import { resolveCurrentGivingMemberIdentity } from '@/auth/giving-member-identity'
import { createGivingRockClient } from '@/lib/giving/rock-client'

export const dynamic = 'force-dynamic'
const HEADERS = { 'Cache-Control':'private, no-store, max-age=0', 'Referrer-Policy':'no-referrer', 'X-Robots-Tag':'noindex, nofollow, noarchive' }

export interface GivingIdentityDependencies {
  resolve(): ReturnType<typeof resolveCurrentGivingMemberIdentity>
}

const defaults: GivingIdentityDependencies = {
  resolve: () => resolveCurrentGivingMemberIdentity({ rockClient:createGivingRockClient() }),
}

export async function handleGivingIdentityGet(dependencies: GivingIdentityDependencies = defaults) {
  try {
    const identity = await dependencies.resolve()
    if (!identity.signedIn) return NextResponse.json({ signedIn:false }, { status:200,headers:HEADERS })
    return NextResponse.json({
      signedIn:true,
      ...(identity.firstName ? { firstName:identity.firstName } : {}),
      ...(identity.lastName ? { lastName:identity.lastName } : {}),
      ...(identity.email ? { email:identity.email } : {}),
    }, { status:200,headers:HEADERS })
  } catch {
    return NextResponse.json({ error:'Identity unavailable' }, { status:503,headers:HEADERS })
  }
}

export async function GET() { return handleGivingIdentityGet() }
