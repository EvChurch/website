import type { Pool } from 'pg'
import { NextRequest, NextResponse } from 'next/server'

import { createGivingCheckoutService, createPostgresGivingCheckoutRepository, capabilityDigest, submissionKeyDigest } from '@/lib/giving/service'
import { isGivingCapabilityToken, parseGivingCheckoutStatus, type GivingCheckoutStatus } from '@/lib/giving/contracts'
import { getPayloadClient } from '@/lib/payload'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import { stripeGivingStatus } from '@/lib/giving/stripe/service'
import { getBlinkPayRuntimeClient } from '@/lib/giving/blinkpay/runtime-client'

export const dynamic='force-dynamic'
const HEADERS={'Cache-Control':'private, no-store, max-age=0','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive'}
export interface GivingStatusDependencies { read(token:string, expectedSubmissionKey?:string):Promise<GivingCheckoutStatus> }
function json(value:unknown,status:number){return NextResponse.json(value,{status,headers:HEADERS})}

async function defaultRead(token:string,expectedSubmissionKey?:string){
  return readGivingCheckoutStatus(requireGivingPostgresPool(await getPayloadClient()),token,expectedSubmissionKey)
}

export async function readGivingCheckoutStatus(pool:Pool,token:string,expectedSubmissionKey?:string){
  if(expectedSubmissionKey){
    const checkout=await createPostgresGivingCheckoutRepository(pool).findByStatusCapability(capabilityDigest('status',token),new Date())
    if(!isGivingCapabilityToken(expectedSubmissionKey) || !checkout || checkout.submissionKeyDigest!==submissionKeyDigest(process.env.GIVING_CHECKOUT_DIGEST_SECRET??'',checkout,expectedSubmissionKey)) throw new Error('Checkout does not match submission')
  }
  const cardStatus=await stripeGivingStatus(pool,token);if(cardStatus)return cardStatus
  const unavailable=async()=>{throw new Error('provider unavailable')}
  const service=createGivingCheckoutService({repository:createPostgresGivingCheckoutRepository(pool),digestSecret:process.env.GIVING_CHECKOUT_DIGEST_SECRET??'',resolveIdentity:unavailable,blinkPay:getBlinkPayRuntimeClient})
  return service.status(token)
}

export async function handleGivingStatusGet(request:NextRequest,context:{params:Promise<{token:string}>},dependencies:GivingStatusDependencies={read:defaultRead}){
  try{const{token}=await context.params;if(token!=='current')return json({error:'Status unavailable'},404);const capability=request.cookies.get('__Host-ev_giving_checkout')?.value;if(!capability)return json({error:'Status unavailable'},404);const expected=request.headers.get('x-ev-giving-submission-key');if(expected!==null&&!isGivingCapabilityToken(expected))return json({error:'Status unavailable'},404);const status=parseGivingCheckoutStatus(await (expected ? dependencies.read(capability,expected) : dependencies.read(capability)));const output=json(status,200);if(['verified','cancelled','rejected','expired'].includes(status.state))output.cookies.set('__Host-ev_giving_checkout','',{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:0});return output}catch{return json({error:'Status unavailable'},404)}
}
export async function GET(request:NextRequest,context:{params:Promise<{token:string}>}){return handleGivingStatusGet(request,context)}
