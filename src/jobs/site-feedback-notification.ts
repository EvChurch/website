import { randomUUID } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import type { Payload, TaskConfig } from 'payload'

import { drizzleResultRows } from '@/lib/rock-connection-signups/db-result'
import {
  buildSiteFeedbackNotification,
  createResendSiteFeedbackTransport,
  sanitizeNotificationError,
  SITE_FEEDBACK_NOTIFICATION_WINDOW_MS,
  type SiteFeedbackNotificationSource,
  type SiteFeedbackNotificationTransport,
} from '@/lib/site-feedback/notification'

export const SITE_FEEDBACK_NOTIFICATION_QUEUE = 'notifications'
export const SITE_FEEDBACK_NOTIFICATION_AUTO_RUN = {
  cron: '* * * * *',
  queue: SITE_FEEDBACK_NOTIFICATION_QUEUE,
  limit: 10,
} as const
export const SEND_SITE_FEEDBACK_NOTIFICATION_TASK =
  'sendSiteFeedbackNotification'
export const RECONCILE_SITE_FEEDBACK_NOTIFICATIONS_TASK =
  'reconcileSiteFeedbackNotifications'
const LEASE_DURATION_MS = 5 * 60 * 1_000
const RECONCILIATION_LIMIT = 100
const MAX_NOTIFICATION_ATTEMPTS = 6

type ClaimedFeedback = SiteFeedbackNotificationSource & { leaseToken: string }

type ClaimResult =
  | { status: 'claimed'; feedback: ClaimedFeedback }
  | { status: 'skipped' }

export type SiteFeedbackNotificationStore = {
  claim(feedbackId: number | string, now: Date): Promise<ClaimResult>
  markSent(
    feedbackId: number | string,
    leaseToken: string,
    providerId: string,
    now: Date,
  ): Promise<void>
  releaseForRetry(
    feedbackId: number | string,
    leaseToken: string,
    error: string,
    now: Date,
  ): Promise<void>
  findRecoverable(now: Date): Promise<Array<number | string>>
  findExpired(now: Date): Promise<Array<number | string>>
  markExpired(feedbackId: number | string, now: Date): Promise<void>
  queue(feedbackId: number | string): Promise<void>
}

function queryRows<T>(result: unknown): T[] {
  return drizzleResultRows(result) as T[]
}

export function createPayloadSiteFeedbackNotificationStore(
  payload: Payload,
): SiteFeedbackNotificationStore {
  const execute = (query: ReturnType<typeof sql>) =>
    payload.db.drizzle.execute(query)

  return {
    async claim(feedbackId, now) {
      const leaseToken = randomUUID()
      const leaseExpiresAt = new Date(now.getTime() + LEASE_DURATION_MS)
      const windowCutoff = new Date(
        now.getTime() - SITE_FEEDBACK_NOTIFICATION_WINDOW_MS,
      )
      const result = await execute(sql`
        UPDATE "feedback_submissions"
        SET
          "notification_status" = 'sending',
          "notification_attempt_count" = "notification_attempt_count" + 1,
          "notification_last_attempt_at" = ${now},
          "notification_lease_token" = ${leaseToken},
          "notification_lease_expires_at" = ${leaseExpiresAt},
          "notification_error" = NULL,
          "updated_at" = ${now}
        WHERE "id" = ${feedbackId}
          AND "notification_recipient" IS NOT NULL
          AND "notification_recipient" <> ''
          AND "notification_window_started_at" > ${windowCutoff}
          AND "notification_attempt_count" < ${MAX_NOTIFICATION_ATTEMPTS}
          AND (
            "notification_status" = 'pending'
            OR (
              "notification_status" = 'sending'
              AND "notification_lease_expires_at" <= ${now}
            )
          )
        RETURNING
          "id",
          "comment",
          "email",
          "post_hog_replay_url",
          "source_url",
          "created_at",
          "notification_recipient"
      `)
      const [row] = queryRows<{
        id: number | string
        comment: string
        email: null | string
        post_hog_replay_url: null | string
        source_url: string
        created_at: Date | string
        notification_recipient: string
      }>(result)
      if (!row) return { status: 'skipped' }

      return {
        status: 'claimed',
        feedback: {
          id: row.id,
          comment: row.comment,
          email: row.email,
          postHogReplayUrl: row.post_hog_replay_url,
          sourceUrl: row.source_url,
          createdAt:
            row.created_at instanceof Date
              ? row.created_at.toISOString()
              : row.created_at,
          notificationRecipient: row.notification_recipient,
          leaseToken,
        },
      }
    },

    async markSent(feedbackId, leaseToken, providerId, now) {
      const result = await execute(sql`
        UPDATE "feedback_submissions"
        SET
          "notification_status" = 'sent',
          "notification_sent_at" = ${now},
          "notification_provider_id" = ${providerId},
          "notification_lease_token" = NULL,
          "notification_lease_expires_at" = NULL,
          "notification_error" = NULL,
          "updated_at" = ${now}
        WHERE "id" = ${feedbackId}
          AND "notification_status" = 'sending'
          AND "notification_lease_token" = ${leaseToken}
        RETURNING "id"
      `)
      if (queryRows(result).length !== 1) {
        throw new Error('Notification state update failed')
      }
    },

    async releaseForRetry(feedbackId, leaseToken, error, now) {
      await execute(sql`
        UPDATE "feedback_submissions"
        SET
          "notification_status" = 'pending',
          "notification_lease_token" = NULL,
          "notification_lease_expires_at" = NULL,
          "notification_error" = ${error.slice(0, 200)},
          "updated_at" = ${now}
        WHERE "id" = ${feedbackId}
          AND "notification_status" = 'sending'
          AND "notification_lease_token" = ${leaseToken}
      `)
    },

    async findRecoverable(now) {
      const windowCutoff = new Date(
        now.getTime() - SITE_FEEDBACK_NOTIFICATION_WINDOW_MS,
      )
      const result = await execute(sql`
        SELECT "id"
        FROM "feedback_submissions"
        WHERE "notification_recipient" IS NOT NULL
          AND "notification_recipient" <> ''
          AND "notification_window_started_at" > ${windowCutoff}
          AND "notification_attempt_count" < ${MAX_NOTIFICATION_ATTEMPTS}
          AND (
            "notification_status" = 'pending'
            OR (
              "notification_status" = 'sending'
              AND "notification_lease_expires_at" <= ${now}
            )
          )
        ORDER BY "notification_window_started_at" ASC
        LIMIT ${RECONCILIATION_LIMIT}
      `)
      return queryRows<{ id: number | string }>(result).map(({ id }) => id)
    },

    async findExpired(now) {
      const windowCutoff = new Date(
        now.getTime() - SITE_FEEDBACK_NOTIFICATION_WINDOW_MS,
      )
      const result = await execute(sql`
        SELECT "id"
        FROM "feedback_submissions"
        WHERE "notification_status" IN ('pending', 'sending')
          AND "notification_window_started_at" IS NOT NULL
          AND (
            "notification_window_started_at" <= ${windowCutoff}
            OR "notification_attempt_count" >= ${MAX_NOTIFICATION_ATTEMPTS}
          )
        ORDER BY "notification_window_started_at" ASC
        LIMIT ${RECONCILIATION_LIMIT}
      `)
      return queryRows<{ id: number | string }>(result).map(({ id }) => id)
    },

    async markExpired(feedbackId, now) {
      const windowCutoff = new Date(
        now.getTime() - SITE_FEEDBACK_NOTIFICATION_WINDOW_MS,
      )
      await execute(sql`
        UPDATE "feedback_submissions"
        SET
          "notification_status" = 'failed',
          "notification_lease_token" = NULL,
          "notification_lease_expires_at" = NULL,
          "notification_error" = 'Notification recovery window expired',
          "updated_at" = ${now}
        WHERE "id" = ${feedbackId}
          AND "notification_status" IN ('pending', 'sending')
          AND (
            "notification_window_started_at" <= ${windowCutoff}
            OR "notification_attempt_count" >= ${MAX_NOTIFICATION_ATTEMPTS}
          )
      `)
    },

    async queue(feedbackId) {
      await payload.jobs.queue({
        task: SEND_SITE_FEEDBACK_NOTIFICATION_TASK,
        input: { feedbackId: Number(feedbackId) },
        queue: SITE_FEEDBACK_NOTIFICATION_QUEUE,
        overrideAccess: true,
      })
    },
  }
}

export async function deliverSiteFeedbackNotification({
  feedbackId,
  notificationStore,
  transport,
  now = new Date(),
}: {
  feedbackId: number | string
  notificationStore: SiteFeedbackNotificationStore
  transport: SiteFeedbackNotificationTransport
  now?: Date
}): Promise<{ sent: boolean }> {
  const claim = await notificationStore.claim(feedbackId, now)
  if (claim.status === 'skipped') return { sent: false }

  const { feedback } = claim
  let providerId: string
  try {
    const result = await transport.send(
      buildSiteFeedbackNotification(feedback),
      `site-feedback/${feedback.id}`,
    )
    providerId = result.providerId
  } catch (caught) {
    const safeError = sanitizeNotificationError(caught)
    await notificationStore.releaseForRetry(
      feedback.id,
      feedback.leaseToken,
      safeError,
      now,
    )
    throw new Error(safeError)
  }

  try {
    await notificationStore.markSent(
      feedback.id,
      feedback.leaseToken,
      providerId,
      now,
    )
  } catch {
    // Preserve the lease: reconciliation can retry with the same provider
    // idempotency key while it remains inside Resend's 24-hour window.
    throw new Error('Notification state update failed')
  }
  return { sent: true }
}

export async function reconcileSiteFeedbackNotifications({
  notificationStore,
  now = new Date(),
}: {
  notificationStore: SiteFeedbackNotificationStore
  now?: Date
}): Promise<{ expired: number; queued: number }> {
  const [expired, recoverable] = await Promise.all([
    notificationStore.findExpired(now),
    notificationStore.findRecoverable(now),
  ])
  await Promise.all(expired.map((id) => notificationStore.markExpired(id, now)))
  await Promise.all(recoverable.map((id) => notificationStore.queue(id)))
  return { expired: expired.length, queued: recoverable.length }
}

const sendSiteFeedbackNotificationTask: TaskConfig<{
  input: { feedbackId: number }
  output: { sent: boolean }
}> = {
  slug: SEND_SITE_FEEDBACK_NOTIFICATION_TASK,
  retries: {
    attempts: 3,
    backoff: { delay: 60_000, type: 'exponential' },
  },
  inputSchema: [{ name: 'feedbackId', type: 'number', required: true }],
  outputSchema: [{ name: 'sent', type: 'checkbox', required: true }],
  handler: async ({ input, req }) => ({
    output: await deliverSiteFeedbackNotification({
      feedbackId: input.feedbackId,
      notificationStore: createPayloadSiteFeedbackNotificationStore(req.payload),
      transport: createResendSiteFeedbackTransport(),
    }),
  }),
}

const reconcileSiteFeedbackNotificationsTask: TaskConfig<{
  input: Record<string, never>
  output: { expired: number; queued: number }
}> = {
  slug: RECONCILE_SITE_FEEDBACK_NOTIFICATIONS_TASK,
  retries: 2,
  inputSchema: [],
  outputSchema: [
    { name: 'expired', type: 'number', required: true },
    { name: 'queued', type: 'number', required: true },
  ],
  schedule: [
    { cron: '*/5 * * * *', queue: SITE_FEEDBACK_NOTIFICATION_QUEUE },
  ],
  handler: async ({ req }) => ({
    output: await reconcileSiteFeedbackNotifications({
      notificationStore: createPayloadSiteFeedbackNotificationStore(req.payload),
    }),
  }),
}

export const notificationJobConfigs = [
  sendSiteFeedbackNotificationTask,
  reconcileSiteFeedbackNotificationsTask,
]
