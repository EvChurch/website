import { NextRequest, NextResponse } from 'next/server'

import { GIVING_REQUEST_MARKERS } from '@/lib/giving/contracts'
import { verifyGivingBankAcknowledgementToken } from '@/lib/giving/email-links'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import { boundedGivingJson, GIVING_PRIVATE_HEADERS, InvalidGivingRequestError, isGivingJson, trustedGivingMutation } from '@/lib/giving/request-boundary'
import { acknowledgeGivingBankSetupByCheckoutId, createPostgresGivingCheckoutRepository } from '@/lib/giving/service'
import { getPayloadClient } from '@/lib/payload'

export const dynamic = 'force-dynamic'

export interface GivingEmailAcknowledgementDependencies {
  acknowledge(checkoutId: number): Promise<boolean>
  verify(token: unknown): { checkoutId: number } | null
}

const defaults: GivingEmailAcknowledgementDependencies = {
  verify: verifyGivingBankAcknowledgementToken,
  async acknowledge(checkoutId) {
    const payload = await getPayloadClient()
    return acknowledgeGivingBankSetupByCheckoutId(checkoutId, { repository:createPostgresGivingCheckoutRepository(requireGivingPostgresPool(payload)) })
  },
}

function response(value: unknown, status: number) { return NextResponse.json(value,{status,headers:GIVING_PRIVATE_HEADERS}) }

export async function handleGivingEmailAcknowledgementPost(request: NextRequest, dependencies: GivingEmailAcknowledgementDependencies = defaults) {
  try {
    if(!trustedGivingMutation(request,GIVING_REQUEST_MARKERS.bankTransferEmailAcknowledgement))return response({error:'Confirmation unavailable'},403)
    if(!isGivingJson(request))return response({error:'Confirmation unavailable'},415)
    const body=await boundedGivingJson(request)
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).join(',')!=='token')return response({error:'Confirmation unavailable'},400)
    const verified=dependencies.verify((body as {token?:unknown}).token)
    if(!verified||!await dependencies.acknowledge(verified.checkoutId))return response({error:'Confirmation unavailable'},404)
    return response({acknowledged:true,verified:false},200)
  } catch(error) {
    if(error instanceof InvalidGivingRequestError)return response({error:'Confirmation unavailable'},400)
    return response({error:'Confirmation unavailable'},503)
  }
}

export async function POST(request: NextRequest) { return handleGivingEmailAcknowledgementPost(request) }
