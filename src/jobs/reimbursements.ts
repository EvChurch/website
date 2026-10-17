import type { TaskConfig } from 'payload'
import type { Pool } from 'pg'
import { reconcileReimbursementEmails } from '@/lib/reimbursements/notifications'

export const reimbursementEmailTask: TaskConfig<{ input: Record<string, never>; output: { sent: number } }> = {
  slug: 'reconcileReimbursementEmails', retries: 1,
  inputSchema: [], outputSchema: [{ name: 'sent', type: 'number', required: true }],
  schedule: [{ cron: '*/5 * * * *', queue: 'notifications' }],
  handler: async ({ req }) => ({ output: await reconcileReimbursementEmails((req.payload.db as unknown as { pool: Pool }).pool) }),
}
