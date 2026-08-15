import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createGivingJobConfigs, GIVING_LIFECYCLE_AUTO_RUN, PROCESS_BLINKPAY_WEBHOOK_EVENT_TASK, RECONCILE_GIVING_LIFECYCLE_TASK } from './index'

describe('giving job registration', () => {
  it('registers event processing and scheduled reconciliation with focused inputs', async () => {
    const processEvent = vi.fn().mockResolvedValue({ status: 'processed' })
    const reconcile = vi.fn().mockResolvedValue({ events: 2, eventFailures: 1, verifications: 1, verificationFailures: 0, continuations: 1, continuationFailures: 1 })
    const tasks = createGivingJobConfigs({ processEvent, reconcile })
    expect(tasks.map((task) => task.slug)).toEqual([PROCESS_BLINKPAY_WEBHOOK_EVENT_TASK, RECONCILE_GIVING_LIFECYCLE_TASK])
    expect(tasks[1].schedule).toEqual([{ cron: '*/5 * * * *', queue: 'giving-lifecycle' }])
    expect(tasks[1].outputSchema?.map((field) => 'name' in field ? field.name : null)).toEqual(['events', 'eventFailures', 'verifications', 'verificationFailures', 'continuations', 'continuationFailures'])
    expect(GIVING_LIFECYCLE_AUTO_RUN).toEqual({ cron: '* * * * *', queue: 'giving-lifecycle', limit: 10 })
    await (tasks[0].handler as Function)({ input: { eventId: 9 }, req: { payload: {} } })
    await (tasks[1].handler as Function)({ input: {}, req: { payload: {} } })
    expect(processEvent).toHaveBeenCalledWith(9, expect.anything())
    expect(reconcile).toHaveBeenCalledWith(expect.anything())
  })

  it('registers the giving worker queue in Payload auto-run', () => {
    const payloadConfig = readFileSync(new URL('../../../payload.config.ts', import.meta.url), 'utf8')
    expect(payloadConfig).toMatch(/autoRun:\s*\[[\s\S]*GIVING_LIFECYCLE_AUTO_RUN/u)
  })
})
