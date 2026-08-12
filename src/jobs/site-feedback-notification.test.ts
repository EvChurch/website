import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createPayloadSiteFeedbackNotificationStore,
  deliverSiteFeedbackNotification,
  notificationJobConfigs,
  SITE_FEEDBACK_NOTIFICATION_AUTO_RUN,
  reconcileSiteFeedbackNotifications,
  type SiteFeedbackNotificationStore,
} from './site-feedback-notification'

function claimed() {
  return {
    id: 42,
    comment: 'Please improve filters.',
    email: 'visitor@example.com',
    sourceUrl: 'https://www.ev.church/events',
    createdAt: '2026-08-13T00:00:00.000Z',
    notificationRecipient: 'tataihono@ev.church',
    leaseToken: 'lease-token',
  }
}

function store(overrides: Partial<SiteFeedbackNotificationStore> = {}) {
  return {
    claim: vi.fn().mockResolvedValue({ status: 'claimed', feedback: claimed() }),
    markSent: vi.fn().mockResolvedValue(undefined),
    releaseForRetry: vi.fn().mockResolvedValue(undefined),
    findExpired: vi.fn().mockResolvedValue([]),
    findRecoverable: vi.fn().mockResolvedValue([]),
    markExpired: vi.fn().mockResolvedValue(undefined),
    queue: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } satisfies SiteFeedbackNotificationStore
}

describe('site feedback notification jobs', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('contacts the provider once when overlapping jobs race for one lease', async () => {
    let available = true
    const notificationStore = store({
      claim: vi.fn().mockImplementation(async () => {
        if (!available) return { status: 'skipped' }
        available = false
        return { status: 'claimed', feedback: claimed() }
      }),
    })
    const transport = { send: vi.fn().mockResolvedValue({ providerId: 'msg-1' }) }
    const now = new Date('2026-08-13T00:01:00.000Z')

    await Promise.all([
      deliverSiteFeedbackNotification({ feedbackId: 42, notificationStore, transport, now }),
      deliverSiteFeedbackNotification({ feedbackId: 42, notificationStore, transport, now }),
    ])

    expect(transport.send).toHaveBeenCalledOnce()
    expect(transport.send).toHaveBeenCalledWith(
      expect.any(Object),
      'site-feedback/42',
    )
    expect(notificationStore.markSent).toHaveBeenCalledWith(
      42,
      'lease-token',
      'msg-1',
      now,
    )
  })

  it('releases retryable state and throws a sanitized error on provider rejection', async () => {
    const notificationStore = store()
    const transport = {
      send: vi.fn().mockRejectedValue(new Error('visitor@example.com provider secret')),
    }

    await expect(
      deliverSiteFeedbackNotification({
        feedbackId: 42,
        notificationStore,
        transport,
        now: new Date('2026-08-13T00:01:00.000Z'),
      }),
    ).rejects.toThrow('Notification delivery failed')
    expect(notificationStore.releaseForRetry).toHaveBeenCalledWith(
      42,
      'lease-token',
      'Notification delivery failed',
      expect.any(Date),
    )
  })

  it('leaves an accepted send leased when recording success fails', async () => {
    const notificationStore = store({
      markSent: vi.fn().mockRejectedValue(new Error('database unavailable')),
    })
    const transport = { send: vi.fn().mockResolvedValue({ providerId: 'msg-1' }) }

    await expect(
      deliverSiteFeedbackNotification({ feedbackId: 42, notificationStore, transport }),
    ).rejects.toThrow('Notification state update failed')
    expect(notificationStore.releaseForRetry).not.toHaveBeenCalled()
  })

  it('keeps missing provider configuration recoverable without leaking values', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('SITE_FEEDBACK_EMAIL_FROM', '')
    const notificationStore = store()

    await expect(
      deliverSiteFeedbackNotification({
        feedbackId: 42,
        notificationStore,
        transport: (await import('@/lib/site-feedback/notification')).createResendSiteFeedbackTransport(),
      }),
    ).rejects.toThrow('Notification delivery failed')
    expect(notificationStore.releaseForRetry).toHaveBeenCalledWith(
      42,
      'lease-token',
      'Notification delivery failed',
      expect.any(Date),
    )
  })

  it('queues recoverable records and terminally expires old records', async () => {
    const queue = vi.fn().mockResolvedValue(undefined)
    const notificationStore = store({
      findRecoverable: vi.fn().mockResolvedValue([1, 2]),
      findExpired: vi.fn().mockResolvedValue([3]),
      queue,
    })

    await reconcileSiteFeedbackNotifications({ notificationStore })

    expect(queue.mock.calls).toEqual([[1], [2]])
    expect(notificationStore.markExpired).toHaveBeenCalledWith(3, expect.any(Date))
  })

  it('caps reconciliation attempts before queueing another retry batch', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] })
    const notificationStore = createPayloadSiteFeedbackNotificationStore({
      db: { drizzle: { execute } },
      jobs: { queue: vi.fn() },
    } as never)

    await notificationStore.findRecoverable(
      new Date('2026-08-13T00:01:00.000Z'),
    )
    await notificationStore.findExpired(
      new Date('2026-08-13T00:01:00.000Z'),
    )

    const recoverableSql = JSON.stringify(execute.mock.calls[0][0])
    const expiredSql = JSON.stringify(execute.mock.calls[1][0])
    expect(recoverableSql).toContain('notification_attempt_count')
    expect(recoverableSql).toContain('<')
    expect(expiredSql).toContain('notification_attempt_count')
    expect(expiredSql).toContain('>=')
  })

  it('registers a five-minute reconciliation task on the notifications queue', () => {
    expect(notificationJobConfigs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'sendSiteFeedbackNotification' }),
        expect.objectContaining({
          slug: 'reconcileSiteFeedbackNotifications',
          schedule: [{ cron: '*/5 * * * *', queue: 'notifications' }],
        }),
      ]),
    )

    expect(SITE_FEEDBACK_NOTIFICATION_AUTO_RUN).toEqual({
      cron: '* * * * *',
      queue: 'notifications',
      limit: 10,
    })
  })
})
