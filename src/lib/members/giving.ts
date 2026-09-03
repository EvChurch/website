import type { Pool } from 'pg'

import { createGivingRockClient } from '@/lib/giving/rock-client'
import { configuredGivingEnvironment } from '@/lib/giving/availability'
import { requireGivingPostgresPool } from '@/lib/giving/postgres'
import { getPayloadClient } from '@/lib/payload'

export const MEMBER_GIFT_HISTORY_PAGE_SIZE = 25
export const MEMBER_RECENT_GIVING_LIMIT = 3
const RECENT_ACTIVITY_DAYS = 10
const MEMBER_CANCELLATION_AUDIT_REASON = 'Member self-service cancellation'
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u

export const CANCELLATION_FEEDBACK_REASONS = [
  'changing_details',
  'circumstances_changed',
  'mistake',
  'prefer_not_to_say',
  'other',
] as const

export type CancellationFeedbackReason = (typeof CANCELLATION_FEEDBACK_REASONS)[number]

export interface MemberGivingActor {
  auth0Subject: string
  rockPersonId: number
  rockPersonAliasId: number
  email: string | null
}

export interface MemberRecurringGift {
  id: number
  amountMinor: number
  frequency: string
  fundName: string
  nextPaymentDate: string | null
}

export interface MemberGivingActivity {
  id: string
  label: 'Set up giving' | 'Cancelling' | 'We’re checking this'
  amountMinor: number
  frequency: string
  fundName: string
  happenedAt: string
}

export interface MemberGiftHistoryItem {
  id: number
  amountMinor: number
  frequency: string
  fundName: string
  giftType: 'One-off' | string
  completedAt: string
}

export interface MemberGiftHistoryPage {
  page: number
  pageSize: number
  totalPages: number
  gifts: MemberGiftHistoryItem[]
}

export interface MemberGivingOverview {
  recurringGifts: MemberRecurringGift[]
  recentActivity: MemberGivingActivity[]
  giftHistory: MemberGiftHistoryPage
}

function positivePage(value: number) {
  return Number.isSafeInteger(value) && value > 0 ? value : 1
}

function amount(value: unknown) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : typeof value === 'string' ? new Date(value).toISOString() : ''
}

async function givingPool() {
  return requireGivingPostgresPool(await getPayloadClient())
}

function memberGivingScope() {
  const environment = configuredGivingEnvironment()
  return environment === 'sandbox'
    ? { contextKey: 'sandbox', environment: 'sandbox', synthetic: true }
    : { contextKey: 'production', environment: 'production', synthetic: false }
}

export async function resolveMemberGivingActor(auth0Subject: string): Promise<MemberGivingActor> {
  const person = await createGivingRockClient().resolveSignedInPerson(auth0Subject)
  return {
    auth0Subject,
    rockPersonId: person.id,
    rockPersonAliasId: person.primaryAliasId,
    email: person.email ?? null,
  }
}

export async function getMemberGiftHistoryPage(
  actor: MemberGivingActor,
  page: number,
  pool?: Pool,
): Promise<MemberGiftHistoryPage> {
  const db = pool ?? await givingPool()
  const scope = memberGivingScope()
  const currentPage = positivePage(page)
  const offset = (currentPage - 1) * MEMBER_GIFT_HISTORY_PAGE_SIZE
  const [countResult, giftResult] = await Promise.all([
    db.query<{ count: string }>(`
      SELECT count(*)::text count
      FROM giving_gifts gift
      JOIN giving_givers giver ON giver.id=gift.giver_id AND giver.context_key=gift.context_key
      WHERE gift.context_key=$1
        AND gift.environment=$2
        AND gift.synthetic=$3
        AND gift.status='settled'
        AND (($3=false AND giver.rock_person_alias_id=$4) OR ($3=true AND lower(giver.email)=lower($5)))
    `, [scope.contextKey, scope.environment, scope.synthetic, actor.rockPersonAliasId, actor.email ?? '']),
    db.query(`
      SELECT gift.id,gift.amount_minor,gift.fund_name,checkout.frequency,gift.schedule_id,
             COALESCE(gift.provider_observed_at,gift.created_at) completed_at
      FROM giving_gifts gift
      JOIN giving_givers giver ON giver.id=gift.giver_id AND giver.context_key=gift.context_key
      JOIN giving_checkouts checkout ON checkout.id=gift.checkout_id AND checkout.context_key=gift.context_key
      WHERE gift.context_key=$1
        AND gift.environment=$2
        AND gift.synthetic=$3
        AND gift.status='settled'
        AND (($3=false AND giver.rock_person_alias_id=$4) OR ($3=true AND lower(giver.email)=lower($5)))
      ORDER BY COALESCE(gift.provider_observed_at,gift.created_at) DESC, gift.id DESC
      LIMIT $6 OFFSET $7
    `, [scope.contextKey, scope.environment, scope.synthetic, actor.rockPersonAliasId, actor.email ?? '', MEMBER_GIFT_HISTORY_PAGE_SIZE, offset]),
  ])
  const total = Number(countResult.rows[0]?.count ?? 0)
  return {
    page: currentPage,
    pageSize: MEMBER_GIFT_HISTORY_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / MEMBER_GIFT_HISTORY_PAGE_SIZE)),
    gifts: giftResult.rows.map((row) => {
      const frequency = text(row.frequency)
      const recurring = row.schedule_id !== null && row.schedule_id !== undefined
      return {
        id: Number(row.id),
        amountMinor: amount(row.amount_minor),
        frequency,
        fundName: text(row.fund_name),
        giftType: recurring ? frequency : 'One-off',
        completedAt: iso(row.completed_at),
      }
    }),
  }
}

export async function getMemberGivingOverview(actor: MemberGivingActor, pool?: Pool): Promise<MemberGivingOverview> {
  const db = pool ?? await givingPool()
  const scope = memberGivingScope()
  const cutoff = new Date(Date.now() - RECENT_ACTIVITY_DAYS * 24 * 60 * 60 * 1_000)
  const [scheduleResult, activityResult, giftHistory] = await Promise.all([
    db.query(`
      SELECT schedule.id,schedule.amount_minor,schedule.frequency,schedule.next_payment_date,checkout.fund_name
      FROM giving_schedules schedule
      JOIN giving_givers giver ON giver.id=schedule.giver_id AND giver.context_key=schedule.context_key
      JOIN giving_checkouts checkout ON checkout.id=schedule.checkout_id AND checkout.context_key=schedule.context_key
      WHERE schedule.context_key=$1
        AND schedule.environment=$2
        AND schedule.synthetic=$3
        AND schedule.status='active'
        AND (($3=false AND giver.rock_person_alias_id=$4) OR ($3=true AND lower(giver.email)=lower($5)))
      ORDER BY schedule.next_payment_date NULLS LAST, schedule.created_at DESC, schedule.id DESC
    `, [scope.contextKey, scope.environment, scope.synthetic, actor.rockPersonAliasId, actor.email ?? '']),
    db.query(`
      SELECT * FROM (
        SELECT ('checkout:' || checkout.id) id,'Set up giving' label,checkout.amount_minor,checkout.frequency,checkout.fund_name,checkout.updated_at happened_at
        FROM giving_checkouts checkout
        JOIN giving_givers giver ON giver.id=checkout.giver_id AND giver.context_key=checkout.context_key
        WHERE checkout.context_key=$1
          AND checkout.environment=$2
          AND checkout.synthetic=$3
          AND checkout.status IN ('authorising','verifying','unknown')
          AND checkout.updated_at >= $6
          AND (($3=false AND giver.rock_person_alias_id=$4) OR ($3=true AND lower(giver.email)=lower($5)))
        UNION ALL
        SELECT ('schedule:' || schedule.id) id,
          CASE WHEN schedule.status='cancel_pending' THEN 'Cancelling' ELSE 'We’re checking this' END label,
          schedule.amount_minor,schedule.frequency,checkout.fund_name,schedule.updated_at happened_at
        FROM giving_schedules schedule
        JOIN giving_givers giver ON giver.id=schedule.giver_id AND giver.context_key=schedule.context_key
        JOIN giving_checkouts checkout ON checkout.id=schedule.checkout_id AND checkout.context_key=schedule.context_key
        WHERE schedule.context_key=$1
          AND schedule.environment=$2
          AND schedule.synthetic=$3
          AND schedule.status IN ('pending','unknown','cancel_pending')
          AND schedule.updated_at >= $6
          AND (($3=false AND giver.rock_person_alias_id=$4) OR ($3=true AND lower(giver.email)=lower($5)))
      ) activity
      ORDER BY happened_at DESC, id DESC
      LIMIT $7
    `, [scope.contextKey, scope.environment, scope.synthetic, actor.rockPersonAliasId, actor.email ?? '', cutoff, MEMBER_RECENT_GIVING_LIMIT]),
    getMemberGiftHistoryPage(actor, 1, db),
  ])
  return {
    recurringGifts: scheduleResult.rows.map((row) => ({
      id: Number(row.id),
      amountMinor: amount(row.amount_minor),
      frequency: text(row.frequency),
      fundName: text(row.fund_name),
      nextPaymentDate: row.next_payment_date ? iso(row.next_payment_date) : null,
    })),
    recentActivity: activityResult.rows.map((row) => ({
      id: text(row.id),
      label: row.label,
      amountMinor: amount(row.amount_minor),
      frequency: text(row.frequency),
      fundName: text(row.fund_name),
      happenedAt: iso(row.happened_at),
    })),
    giftHistory,
  }
}

export function memberCancellationAuditReason() {
  return MEMBER_CANCELLATION_AUDIT_REASON
}

export function parseCancellationFeedback(input: unknown): {
  operationId: number
  reason: CancellationFeedbackReason
  note: string | null
} | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const value = input as Record<string, unknown>
  if (Object.keys(value).some((key) => !['operationId','reason','note'].includes(key))) return null
  if (typeof value.operationId !== 'number' || !Number.isSafeInteger(value.operationId) || value.operationId <= 0) return null
  if (!CANCELLATION_FEEDBACK_REASONS.includes(value.reason as CancellationFeedbackReason)) return null
  const rawNote = typeof value.note === 'string' ? value.note.trim().replace(/\s+/gu, ' ') : ''
  if (rawNote.length > 500 || CONTROL_CHARACTERS.test(rawNote)) return null
  if (value.reason === 'other' && rawNote.length < 1) return null
  return {
    operationId: value.operationId,
    reason: value.reason as CancellationFeedbackReason,
    note: value.reason === 'other' ? rawNote : null,
  }
}

export async function saveMemberCancellationFeedback(
  actor: MemberGivingActor,
  feedback: ReturnType<typeof parseCancellationFeedback> & {},
) {
  const db = await givingPool()
  const result = await db.query(`
    INSERT INTO giving_cancellation_feedback(
      context_key,environment,synthetic,schedule_id,giver_id,operation_id,
      member_rock_person_id,member_rock_person_alias_id,member_auth0_subject,reason,note
    )
    SELECT operation.context_key,operation.environment,operation.synthetic,schedule.id,schedule.giver_id,operation.id,
           $2::numeric,$1::numeric,$3::varchar,$4::varchar,$5::varchar
    FROM giving_provider_operations operation
    JOIN giving_schedules schedule ON schedule.id=operation.schedule_id AND schedule.context_key=operation.context_key
    JOIN giving_givers giver ON giver.id=schedule.giver_id AND giver.context_key=schedule.context_key
    WHERE operation.id=$6
      AND operation.action='blinkpay.cancel-schedule'
      AND operation.status='succeeded'
      AND operation.environment='production'
      AND operation.synthetic=false
      AND operation.member_actor_rock_person_alias_id=$1
      AND operation.member_actor_rock_person_id=$2
      AND operation.member_actor_auth0_subject=$3
      AND giver.rock_person_alias_id=$1
    ON CONFLICT(operation_id) DO UPDATE SET
      reason=EXCLUDED.reason,
      note=EXCLUDED.note,
      updated_at=now()
    RETURNING id
  `, [actor.rockPersonAliasId, actor.rockPersonId, actor.auth0Subject, feedback.reason, feedback.note, feedback.operationId])
  return result.rowCount === 1
}
