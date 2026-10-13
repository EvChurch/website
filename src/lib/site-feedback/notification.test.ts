import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildSiteFeedbackNotification,
  createResendSiteFeedbackTransport,
  sanitizeNotificationError,
} from './notification'

const feedback = {
  id: 42,
  comment: '<script>alert("x")</script> Please add & improve filters.',
  email: 'visitor@example.com',
  postHogReplayUrl: 'https://us.posthog.com/project/123/replay/session-id?t=1',
  sourceUrl: 'https://www.ev.church/events?campus=central&view=all',
  createdAt: '2026-08-13T01:02:03.000Z',
  notificationRecipient: 'tataihono@ev.church',
}

describe('site feedback notification message', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('includes only approved content and uses the visitor as Reply-To', () => {
    const message = buildSiteFeedbackNotification(feedback)

    expect(message).toMatchObject({
      to: 'tataihono@ev.church',
      replyTo: 'visitor@example.com',
      subject: 'New ev.church site feedback',
    })
    expect(message.text).toContain(feedback.comment)
    expect(message.text).toContain(feedback.sourceUrl)
    expect(message.text).toContain(`Session replay: ${feedback.postHogReplayUrl}`)
    expect(message.text).toContain(
      'Open in Payload: https://www.ev.church/admin/collections/feedback-submissions/42',
    )
    expect(message.text).toContain('13 August 2026')
    expect(message.html).toContain('&lt;script&gt;')
    expect(message.html).toContain('&amp;view=all')
    expect(message.html).not.toContain('<script>')
    expect(message.html).toContain('>View session replay</a>')
    expect(message.html).toContain(
      'href="https://www.ev.church/admin/collections/feedback-submissions/42">Open in Payload</a>',
    )
    expect(JSON.stringify(message)).not.toContain('clientAddressDigest')
    expect(JSON.stringify(message)).not.toContain('userAgent')
  })

  it('omits Reply-To and visitor email when none was supplied', () => {
    const message = buildSiteFeedbackNotification({ ...feedback, email: null })

    expect(message).not.toHaveProperty('replyTo')
    expect(message.text).not.toContain('Visitor email')
    expect(message.text).toContain('Session replay:')
    expect(message.text).toContain('Open in Payload:')
  })

  it('omits the session replay link when no replay was captured', () => {
    const message = buildSiteFeedbackNotification({
      ...feedback,
      postHogReplayUrl: null,
    })

    expect(message.text).not.toContain('Session replay:')
    expect(message.html).not.toContain('View session replay')
    expect(message.text).toContain('Open in Payload:')
  })

  it('calls Resend with a stable idempotency key and bounded request', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key')
    vi.stubEnv('SITE_FEEDBACK_EMAIL_FROM', 'Ev Church <website@ev.church>')
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'resend-message-id' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const transport = createResendSiteFeedbackTransport({ fetch })

    await expect(
      transport.send(buildSiteFeedbackNotification(feedback), 'site-feedback/42'),
    ).resolves.toEqual({ providerId: 'resend-message-id' })

    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer re_test_key',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'site-feedback/42',
    })
    expect(JSON.parse(String(init.body))).toEqual({
      from: 'Ev Church <website@ev.church>',
      to: ['tataihono@ev.church'],
      reply_to: 'visitor@example.com',
      subject: 'New ev.church site feedback',
      text: expect.any(String),
      html: expect.any(String),
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('sanitizes provider and configuration errors', () => {
    expect(
      sanitizeNotificationError(
        new Error('visitor@example.com secret-api-key comment body'),
      ),
    ).toBe('Notification delivery failed')
  })
})
