import type { Payload, TaskConfig } from 'payload'

export const PROCESS_BLINKPAY_WEBHOOK_EVENT_TASK = 'processBlinkPayWebhookEvent'
export const RECONCILE_GIVING_LIFECYCLE_TASK = 'reconcileGivingLifecycle'
export const GIVING_LIFECYCLE_QUEUE = 'giving-lifecycle'
export const GIVING_LIFECYCLE_AUTO_RUN = {
  cron: '* * * * *',
  queue: GIVING_LIFECYCLE_QUEUE,
  limit: 10,
} as const

interface GivingJobRunners {
  processEvent(eventId: number, payload: Payload): Promise<{ status: 'skipped' | 'processed' | 'retry' }>
  reconcile(payload: Payload): Promise<{ events: number; eventFailures: number; verifications: number; verificationFailures: number; continuations: number; continuationFailures: number; cancellations: number; cancellationFailures: number; draftsDeleted: number }>
}

export function createGivingJobConfigs(runners: GivingJobRunners) {
  const processEvent: TaskConfig<{ input: { eventId: number }; output: { status: string } }> = {
    slug: PROCESS_BLINKPAY_WEBHOOK_EVENT_TASK,
    retries: 0,
    inputSchema: [{ name: 'eventId', type: 'number', required: true }],
    outputSchema: [{ name: 'status', type: 'text', required: true }],
    handler: async ({ input, req }) => ({ output: await runners.processEvent(input.eventId, req.payload) }),
  }
  const reconcile: TaskConfig<{ input: Record<string, never>; output: { events: number; eventFailures: number; verifications: number; verificationFailures: number; continuations: number; continuationFailures: number; cancellations: number; cancellationFailures: number; draftsDeleted: number } }> = {
    slug: RECONCILE_GIVING_LIFECYCLE_TASK,
    retries: 1,
    inputSchema: [],
    outputSchema: [
      { name: 'events', type: 'number', required: true },
      { name: 'eventFailures', type: 'number', required: true },
      { name: 'verifications', type: 'number', required: true },
      { name: 'verificationFailures', type: 'number', required: true },
      { name: 'continuations', type: 'number', required: true },
      { name: 'continuationFailures', type: 'number', required: true },
      { name: 'cancellations', type: 'number', required: true },
      { name: 'cancellationFailures', type: 'number', required: true },
      { name: 'draftsDeleted', type: 'number', required: true },
    ],
    schedule: [{ cron: '*/5 * * * *', queue: GIVING_LIFECYCLE_QUEUE }],
    handler: async ({ req }) => ({ output: await runners.reconcile(req.payload) }),
  }
  return [processEvent, reconcile]
}

export const givingJobConfigs = createGivingJobConfigs({
  async processEvent(eventId, payload) {
    const { processGivingLifecycleEvent } = await import('./runtime')
    return processGivingLifecycleEvent(eventId, payload)
  },
  async reconcile(payload) {
    const { reconcileGivingLifecycle } = await import('./runtime')
    return reconcileGivingLifecycle(payload)
  },
})
