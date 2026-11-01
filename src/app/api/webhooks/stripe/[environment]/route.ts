import { NextResponse, type NextRequest } from 'next/server'
import { getGivingStripe, loadStripeGivingConfig } from '@/lib/giving/stripe/config'
import { storeStripeEvent } from '@/lib/giving/stripe/lifecycle'
import { getPayloadClient } from '@/lib/payload'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import { GIVING_PRIVATE_HEADERS } from '@/lib/giving/request-boundary'

export const dynamic='force-dynamic'
export async function POST(request:NextRequest,context:{params:Promise<{environment:string}>}) {
  const {environment}=await context.params
  if(environment!=='sandbox' && environment!=='production') return new NextResponse(null,{status:404})
  try {
    const signature=request.headers.get('stripe-signature')
    if(!signature || !request.body) return new NextResponse(null,{status:400})
    const reader=request.body.getReader()
    const chunks:Uint8Array[]=[]
    let size=0
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144){await reader.cancel();return new NextResponse(null,{status:413})}chunks.push(value)}
    const raw=Buffer.concat(chunks)
    const event=getGivingStripe(environment).webhooks.constructEvent(raw,signature,loadStripeGivingConfig(environment).webhookSecret,300)
    if(event.livemode!==(environment==='production'))return new NextResponse(null,{status:400})
    await storeStripeEvent(requireGivingPostgresPool(await getPayloadClient()),environment,event,raw.toString('utf8'))
    return NextResponse.json({received:true},{headers:GIVING_PRIVATE_HEADERS})
  } catch { return new NextResponse(null,{status:400,headers:GIVING_PRIVATE_HEADERS}) }
}
