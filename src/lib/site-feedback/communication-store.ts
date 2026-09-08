import { randomUUID } from 'node:crypto'
import type { Pool as PgPool, PoolClient } from 'pg'

import {
  buildFeedbackCommunication, communicationInput, communicationStage,
  validateCommunicationItems, type CommunicationFeedback, type CommunicationInput,
} from './communication'
import {
  createResendSiteFeedbackTransport, type SiteFeedbackNotificationMessage,
  type SiteFeedbackNotificationTransport,
} from './notification'

type Pool = Pick<PgPool, 'query'> & {
  connect(): Promise<Pick<PoolClient, 'query' | 'release'>>
}

interface CommunicationRow {
  id: string
  status: 'pending' | 'sending' | 'sent' | 'failed'
  message: SiteFeedbackNotificationMessage
  provider_id: string | null
  sent_at: Date | null
  error: string | null
}

interface CommunicationHistoryRow extends CommunicationRow {
  stage: 'triaged' | 'outcome'
  items: CommunicationInput['items']
}

// Stay inside the provider's 24-hour idempotency window, including clock/network margin.
const RETRY_WINDOW_MS = 23 * 60 * 60 * 1_000
const LEASE_MS = 5 * 60 * 1_000

export async function getFeedbackCommunication(pool: Pool, id: string) {
  const { rows } = await pool.query<CommunicationRow>(
    'SELECT id, status, message, provider_id, sent_at, error FROM feedback_communications WHERE id = $1', [id],
  )
  if (!rows[0]) throw new Error('Feedback communication not found.')
  const { message, ...result } = rows[0]
  return { ...result, recipient: message.to }
}

export async function prepareFeedbackCommunication(pool: Pool, input: CommunicationInput, from: string) {
  const { items } = communicationInput.parse(input)
  const ids = items.map(item => item.feedbackId).sort((a, b) => a - b)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Stable row locks serialize overlapping requests and reserve event slots atomically.
    const { rows } = await client.query<CommunicationFeedback>(`
      SELECT id, email, resolution_status AS "resolutionStatus", triaged_at AS "triagedAt",
        delivery_phase AS "deliveryPhase", delivery_verification_result AS "deliveryVerificationResult"
      FROM feedback_submissions WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE`, [ids])
    const recipient = validateCommunicationItems(items, rows)
    const prior = await client.query<{ feedback_id: number; stage: string; communication_id: string }>(`
      SELECT feedback_id, stage, communication_id FROM feedback_communication_events
      WHERE feedback_id = ANY($1::int[])`, [ids])
    const matching = prior.rows.filter(row => items.some(item =>
      item.feedbackId === row.feedback_id && communicationStage(item.kind) === row.stage))
    if (matching.length) {
      const existingIds = new Set(matching.map(row => row.communication_id))
      if (matching.length !== items.length || existingIds.size !== 1) {
        throw new Error('Some outcomes already have an email. Inspect communication history before sending the remaining items.')
      }
      await client.query('COMMIT')
      return matching[0].communication_id
    }
    if (items.some(item => item.kind === 'triaged' && prior.rows.some(row =>
      row.feedback_id === item.feedbackId && row.stage === 'outcome'))) {
      throw new Error('An outcome email already replaces this triage acknowledgement.')
    }
    const message = buildFeedbackCommunication(recipient, items, from)
    const id = randomUUID()
    await client.query(`INSERT INTO feedback_communications (id, message, items)
      VALUES ($1, $2::jsonb, $3::jsonb)`, [id, JSON.stringify(message), JSON.stringify(items)])
    for (const item of items) {
      await client.query(`INSERT INTO feedback_communication_events (feedback_id, stage, communication_id)
        VALUES ($1, $2, $3)`, [item.feedbackId, communicationStage(item.kind), id])
    }
    await client.query('COMMIT')
    return id
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function deliverFeedbackCommunication(
  pool: Pool, id: string, transport: SiteFeedbackNotificationTransport = createResendSiteFeedbackTransport(),
  now = new Date(),
) {
  const token = randomUUID()
  const cutoff = new Date(now.getTime() - RETRY_WINDOW_MS)
  const leaseExpiry = new Date(now.getTime() + LEASE_MS)
  const { rows } = await pool.query<CommunicationRow & { attempts: number; items: CommunicationInput['items'] }>(`
    UPDATE feedback_communications SET status = 'sending', attempts = attempts + 1,
      first_attempt_at = COALESCE(first_attempt_at, $2), lease_token = $3, lease_expires_at = $4, error = NULL
    WHERE id = $1 AND attempts < 6 AND (first_attempt_at IS NULL OR first_attempt_at > $5)
      AND ((status = 'pending' AND next_attempt_at <= $2)
        OR (status = 'sending' AND lease_expires_at <= $2))
    RETURNING id, status, message, provider_id, sent_at, error, attempts, items`, [id, now, token, leaseExpiry, cutoff])
  const row = rows[0]
  if (!row) return getFeedbackCommunication(pool, id)
  // A delayed retry must not send obsolete triage, an unverified outcome, or to
  // an address that has since been corrected on the feedback submission.
  const current = await pool.query<CommunicationFeedback>(`SELECT id, email,
    resolution_status AS "resolutionStatus", triaged_at AS "triagedAt",
    delivery_phase AS "deliveryPhase", delivery_verification_result AS "deliveryVerificationResult"
    FROM feedback_submissions WHERE id = ANY($1::int[])`, [row.items.map(item => item.feedbackId)])
  try {
    if (validateCommunicationItems(row.items, current.rows) !== row.message.to) {
      throw new Error('Recipient changed')
    }
  } catch {
    await pool.query(`UPDATE feedback_communications SET status = 'failed',
      error = 'Feedback state or recipient changed; inspect history before manual recovery',
      lease_token = NULL, lease_expires_at = NULL WHERE id = $1 AND lease_token = $2`, [id, token])
    return getFeedbackCommunication(pool, id)
  }
  let providerId: string
  try {
    const result = await transport.send(row.message, `feedback-communication/${id}`)
    providerId = result.providerId
  } catch {
    await pool.query(`UPDATE feedback_communications SET status = 'pending',
      lease_token = NULL, lease_expires_at = NULL, next_attempt_at = $3,
      error = 'Email provider delivery failed; retry scheduled'
      WHERE id = $1 AND lease_token = $2`,
    [id, token, new Date(now.getTime() + 60_000 * 2 ** (row.attempts - 1))])
    return getFeedbackCommunication(pool, id)
  }
  // If this write fails, preserve the lease. Retry the immutable message with the same provider key.
  const saved = await pool.query(`UPDATE feedback_communications SET status = 'sent',
    provider_id = $3, sent_at = $4, lease_token = NULL, lease_expires_at = NULL, error = NULL
    WHERE id = $1 AND status = 'sending' AND lease_token = $2`, [id, token, providerId, new Date()])
  if (saved.rowCount !== 1) throw new Error('Email state update failed; inspect communication history.')
  return getFeedbackCommunication(pool, id)
}

export async function reconcileFeedbackCommunications(pool: Pool, now = new Date()) {
  const cutoff = new Date(now.getTime() - RETRY_WINDOW_MS)
  await pool.query(`UPDATE feedback_communications SET status = 'failed',
    error = 'Automatic retries stopped; inspect provider history before any manual resend'
    WHERE (status = 'pending' OR (status = 'sending' AND lease_expires_at <= $1))
      AND (attempts >= 6 OR first_attempt_at <= $2)`, [now, cutoff])
  const { rows } = await pool.query<{ id: string }>(`SELECT id FROM feedback_communications
    WHERE (status = 'pending' AND next_attempt_at <= $1) OR (status = 'sending' AND lease_expires_at <= $1)
    ORDER BY created_at LIMIT 10`, [now])
  for (const row of rows) await deliverFeedbackCommunication(pool, row.id)
  return { processed: rows.length }
}

export async function feedbackCommunicationHistory(pool: Pool, feedbackId: number) {
  const { rows } = await pool.query<CommunicationHistoryRow>(`SELECT c.id, e.stage, c.status, c.sent_at, c.provider_id,
    c.error, c.message, c.items FROM feedback_communication_events e
    JOIN feedback_communications c ON c.id = e.communication_id
    WHERE e.feedback_id = $1 ORDER BY c.created_at`, [feedbackId])
  return rows
}
