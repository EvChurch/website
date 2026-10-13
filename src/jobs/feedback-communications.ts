import type { TaskConfig } from 'payload'
import { reconcileFeedbackCommunications } from '@/lib/site-feedback/communication-store'
import { SITE_FEEDBACK_NOTIFICATION_QUEUE } from './site-feedback-notification'

export const feedbackCommunicationsTask: TaskConfig<{
  input: Record<string, never>
  output: { processed: number }
}> = {
  slug: 'reconcileFeedbackCommunications',
  retries: 2,
  inputSchema: [],
  outputSchema: [{ name: 'processed', type: 'number', required: true }],
  schedule: [{ cron: '* * * * *', queue: SITE_FEEDBACK_NOTIFICATION_QUEUE }],
  handler: async ({ req }) => ({ output: await reconcileFeedbackCommunications(req.payload.db.pool) }),
}
