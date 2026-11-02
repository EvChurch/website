import { NextResponse, type NextRequest } from 'next/server'
import { MEMBER_GIVING_PRIVATE_HEADERS, requireMemberGivingActor } from '../../../auth'
import { isSameOriginRequest } from '@/lib/request-origin'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import { getPayloadClient } from '@/lib/payload'
import { configuredGivingEnvironment } from '@/lib/giving/availability'
import { getGivingStripe, loadStripeGivingConfig } from '@/lib/giving/stripe/config'

export const dynamic='force-dynamic'
export async function POST(request:NextRequest,context:{params:Promise<{id:string}>}) {
  const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:MEMBER_GIVING_PRIVATE_HEADERS})
  if(!isSameOriginRequest(request))return json({error:'Invalid request'},400)
  const actor=await requireMemberGivingActor(request)
  if(!actor)return json({error:'Sign in required'},401)
  const {id}=await context.params
  if(!/^[1-9][0-9]*$/u.test(id) || !Number.isSafeInteger(Number(id)))return json({error:'Not found'},404)
  try {
    const pool=requireGivingPostgresPool(await getPayloadClient())
    const environment=configuredGivingEnvironment()
    if(!environment)return json({error:'Unavailable'},503)
    const row=(await pool.query<{customer_id:string}>(`SELECT session.customer_id FROM giving_schedules schedule JOIN giving_stripe_sessions session ON session.checkout_id=schedule.checkout_id JOIN giving_givers giver ON giver.id=schedule.giver_id AND giver.context_key=schedule.context_key
      WHERE schedule.id=$1 AND schedule.payment_provider='stripe' AND schedule.status='active' AND schedule.environment=$2
      AND (($3=false AND giver.rock_person_alias_id=$4) OR ($3=true AND lower(giver.email)=lower($5)))`,[Number(id),environment,environment==='sandbox',actor.rockPersonAliasId,actor.email??''])).rows[0]
    if(!row)return json({error:'Not found'},404)
    // Reserve the version before contacting Stripe. The schedule lock also serializes
    // reservations with webhook application and cancellation.
    const reserved=(await pool.query<{version:string}>(`INSERT INTO giving_stripe_card_updates(schedule_id,customer_id,environment)
      SELECT id,$2,$3 FROM giving_schedules WHERE id=$1 AND status='active' AND environment=$3 AND payment_provider='stripe' FOR UPDATE
      RETURNING version`,[Number(id),row.customer_id,environment])).rows[0]
    if(!reserved)return json({error:'Not found'},404)
    const config=loadStripeGivingConfig(environment)
    const session=await getGivingStripe(environment).checkout.sessions.create({ui_mode:'hosted_page',mode:'setup',customer:row.customer_id,currency:'nzd',allowed_payment_method_types:['card'],success_url:`${config.origin}/members/giving`,cancel_url:`${config.origin}/members/giving`,metadata:{ev_card_update:id,ev_card_update_version:String(reserved.version)}},{idempotencyKey:`giving-card-setup-${reserved.version}`})
    if(!session.url || new URL(session.url).origin!=='https://checkout.stripe.com')throw new Error('Invalid update destination')
    await pool.query('UPDATE giving_stripe_card_updates SET session_id=$2 WHERE version=$1',[reserved.version,session.id])
    return json({url:session.url})
  } catch {return json({error:'Could not open secure card update'},503)}
}
