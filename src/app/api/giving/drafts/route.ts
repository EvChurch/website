import { randomBytes } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import { getAuth0Client } from '@/auth/auth0-client'
import {
  createGivingDraftService,
  createPayloadGivingDraftStore,
  givingCapabilityCookieNames,
  validateGivingDraftAnswers,
  type GivingDraftBinding,
} from '@/lib/giving/drafts'
import { getPayloadClient } from '@/lib/payload'
import { isSameOriginRequest } from '@/lib/request-origin'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 8_192
export const GIVING_PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const

async function currentSubject() {
  try {
    const session = await getAuth0Client().getSession()
    return typeof session?.user?.sub === 'string' && session.user.sub ? session.user.sub : null
  } catch {
    return null
  }
}

async function boundedJson(request: NextRequest) {
  const declared = request.headers.get('content-length')
  if (declared && (!Number.isSafeInteger(Number(declared)) || Number(declared) > MAX_BODY_BYTES)) throw new Error('invalid')
  if (!request.body) throw new Error('invalid')
  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) throw new Error('invalid')
    text += decoder.decode(value, { stream: true })
  }
  text += decoder.decode()
  return JSON.parse(text) as unknown
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

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) return response({ error: 'Draft unavailable' }, 403)
    if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') return response({ error: 'Draft unavailable' }, 415)
    const answers = validateGivingDraftAnswers(await boundedJson(request))
    const subject = await currentSubject()
    const { secure, names } = cookiePolicy(request)
    const existingNonce = request.cookies.get(names.guest)?.value
    const nonce = existingNonce || randomBytes(32).toString('base64url')
    const binding: GivingDraftBinding = subject
      ? { audience: 'member', subject }
      : { audience: 'guest', nonce }
    const draft = await (await service()).create({ answers, binding })
    const result = response({ resumePath: `/give/resume/${draft.token}` }, 201)
    if (!subject && !existingNonce) {
      result.cookies.set(names.guest, nonce, {
        httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 15 * 60,
      })
    }
    return result
  } catch {
    return response({ error: 'Draft unavailable' }, 400)
  }
}

export async function PUT(request:NextRequest){
  try{
    if(!isSameOriginRequest(request))return response({error:'Draft unavailable'},403)
    if(request.headers.get('content-type')?.split(';',1)[0]?.trim().toLowerCase()!=='application/json')return response({error:'Draft unavailable'},415)
    const answers=validateGivingDraftAnswers(await boundedJson(request))
    const memberSubject=await currentSubject()
    const{secure,names}=cookiePolicy(request)
    const existingNonce=request.cookies.get(names.guest)?.value
    const nonce=existingNonce||randomBytes(32).toString('base64url')
    const binding:GivingDraftBinding=memberSubject?{audience:'member',subject:memberSubject}:{audience:'guest',nonce}
    const draftService=await service()
    const session=await draftService.createSession({answers,binding})
    const prior=request.cookies.get(names.resume)?.value
    if(prior)await draftService.revokeSession(prior)
    const result=new NextResponse(null,{status:204,headers:GIVING_PRIVATE_HEADERS})
    if(!memberSubject&&!existingNonce)result.cookies.set(names.guest,nonce,{httpOnly:true,secure,sameSite:'lax',path:'/',maxAge:15*60})
    result.cookies.set(names.resume,session.token,{httpOnly:true,secure,sameSite:'strict',path:'/',maxAge:15*60})
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
  if (token) await (await service()).revokeSession(token).catch(() => undefined)
  const result = response({ ok: true })
  result.cookies.delete(names.resume)
  return result
}
