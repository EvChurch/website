import { randomBytes } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import { getAuth0Client } from '@/auth/auth0-client'
import {
  createGivingDraftService,
  createPayloadGivingDraftStore,
  givingCapabilityCookieNames,
  GIVING_DRAFT_TTL_MS,
  validateGivingDraftAnswers,
  type GivingDraftBinding,
} from '@/lib/giving/drafts'
import { getPayloadClient } from '@/lib/payload'
import { boundedGivingJson, GIVING_PRIVATE_HEADERS, isGivingJson } from '@/lib/giving/request-boundary'
import { isSameOriginRequest } from '@/lib/request-origin'

export const dynamic = 'force-dynamic'

async function currentSubject() {
  try {
    const session = await getAuth0Client().getSession()
    return typeof session?.user?.sub === 'string' && session.user.sub ? session.user.sub : null
  } catch {
    return null
  }
}

function response(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: GIVING_PRIVATE_HEADERS })
}

function cookiePolicy(request: NextRequest) {
  const secure = process.env.NODE_ENV === 'production' || request.nextUrl.protocol === 'https:'
  return { secure, names: givingCapabilityCookieNames(secure) }
}

async function service() {
  const payload = await getPayloadClient()
  return createGivingDraftService(createPayloadGivingDraftStore(payload))
}

export async function PUT(request:NextRequest){
  try{
    if(!isSameOriginRequest(request))return response({error:'Draft unavailable'},403)
    if(!isGivingJson(request))return response({error:'Draft unavailable'},415)
    const answers=validateGivingDraftAnswers(await boundedGivingJson(request))
    const [memberSubject,draftService]=await Promise.all([currentSubject(),service()])
    const{secure,names}=cookiePolicy(request)
    const existingNonce=request.cookies.get(names.guest)?.value
    const nonce=existingNonce||randomBytes(32).toString('base64url')
    const binding:GivingDraftBinding=memberSubject?{audience:'member',subject:memberSubject}:{audience:'guest',nonce}
    const session=await draftService.createSession({answers,binding})
    const prior=request.cookies.get(names.resume)?.value
    if(prior)await draftService.revokeSession(prior)
    const result=new NextResponse(null,{status:204,headers:GIVING_PRIVATE_HEADERS})
    if(!memberSubject&&!existingNonce)result.cookies.set(names.guest,nonce,{httpOnly:true,secure,sameSite:'lax',path:'/',maxAge:GIVING_DRAFT_TTL_MS/1_000})
    result.cookies.set(names.resume,session.token,{httpOnly:true,secure,sameSite:'strict',path:'/',maxAge:GIVING_DRAFT_TTL_MS/1_000})
    return result
  }catch{return response({error:'Draft unavailable'},400)}
}

export async function GET(request: NextRequest) {
  try {
    const { names } = cookiePolicy(request)
    const token = request.cookies.get(names.resume)?.value
    const subject = await currentSubject()
    const nonce = request.cookies.get(names.guest)?.value
    const binding: GivingDraftBinding | null = subject
      ? { audience: 'member', subject }
      : nonce ? { audience: 'guest', nonce } : null
    if (!token || !binding) throw new Error('unavailable')
    const answers = await (await service()).readSession({ token, binding })
    return response({ answers })
  } catch {
    return response({ error: 'Draft unavailable' }, 404)
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) return response({ error: 'Draft unavailable' }, 403)
  const { names } = cookiePolicy(request)
  const token = request.cookies.get(names.resume)?.value
  if (token) {
    try {
      await (await service()).revokeSession(token)
    } catch {
      // Expiring the browser capability still prevents the discarded flow from reopening.
    }
  }
  const result = response({ ok: true })
  result.cookies.delete(names.resume)
  if (request.nextUrl.searchParams.get('scope') === 'flow') {
    result.cookies.delete('__Host-ev_giving_checkout')
    result.cookies.delete('__Host-ev_giving_return')
  }
  return result
}
