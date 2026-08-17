import { NextRequest, NextResponse } from 'next/server'

import { createGivingCheckoutService, createPostgresGivingCheckoutRepository } from '@/lib/giving/service'
import { parseGivingCheckoutStatus, type GivingCheckoutStatus } from '@/lib/giving/contracts'
import { getPayloadClient } from '@/lib/payload'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'

export const dynamic='force-dynamic'
const HEADERS={'Cache-Control':'private, no-store, max-age=0','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive'}
export interface GivingStatusDependencies { read(token:string):Promise<GivingCheckoutStatus> }
function json(value:unknown,status:number){return NextResponse.json(value,{status,headers:HEADERS})}

async function defaultRead(token:string){
  const payload=await getPayloadClient();const pool=requireGivingPostgresPool(payload)
  const unavailable=async()=>{throw new Error('provider unavailable')}
  const service=createGivingCheckoutService({repository:createPostgresGivingCheckoutRepository(pool),digestSecret:process.env.GIVING_CHECKOUT_DIGEST_SECRET??'',resolveIdentity:unavailable,blinkPay:{createQuickPayment:unavailable,getQuickPayment:unavailable,createEnduringConsent:unavailable,getEnduringConsent:unavailable,createFixedRecurringPayment:unavailable,getFixedRecurringPayment:unavailable,isPaymentSettled:()=>false,isConsentAuthorised:()=>false,isFixedRecurringPaymentActive:()=>false}})
  return service.status(token)
}

export async function handleGivingStatusGet(request:NextRequest,context:{params:Promise<{token:string}>},dependencies:GivingStatusDependencies={read:defaultRead}){
  try{const{token}=await context.params;if(token!=='current')return json({error:'Status unavailable'},404);const capability=request.cookies.get('__Host-ev_giving_checkout')?.value;if(!capability)return json({error:'Status unavailable'},404);const status=parseGivingCheckoutStatus(await dependencies.read(capability));const output=json(status,200);if(['verified','cancelled','rejected','expired'].includes(status.state))output.cookies.set('__Host-ev_giving_checkout','',{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:0});return output}catch{return json({error:'Status unavailable'},404)}
}
export async function GET(request:NextRequest,context:{params:Promise<{token:string}>}){return handleGivingStatusGet(request,context)}
