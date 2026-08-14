const RESEND_EMAILS_URL = 'https://api.resend.com/emails'
const DEFAULT_TIMEOUT_MS = 10_000
const SITE_ORIGIN = 'https://www.ev.church'

export const SITE_FEEDBACK_NOTIFICATION_WINDOW_MS = 24 * 60 * 60 * 1_000

export type SiteFeedbackNotificationSource = {
  id: number | string
  comment: string
  email?: null | string
  postHogReplayUrl?: null | string
  sourceUrl: string
  createdAt: string
  notificationRecipient: string
}

export type SiteFeedbackNotificationMessage = {
  to: string
  replyTo?: string
  subject: string
  text: string
  html: string
}

export type SiteFeedbackNotificationTransport = {
  send(
    message: SiteFeedbackNotificationMessage,
    idempotencyKey: string,
  ): Promise<{ providerId: string }>
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case "'":
        return '&#39;'
      case '"':
        return '&quot;'
      default:
        return character
    }
  })
}

function formatSubmissionTime(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value
  return new Intl.DateTimeFormat('en-NZ', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Pacific/Auckland',
  }).format(date)
}

export function buildSiteFeedbackNotification(
  feedback: SiteFeedbackNotificationSource,
): SiteFeedbackNotificationMessage {
  const submissionTime = formatSubmissionTime(feedback.createdAt)
  const visitorEmail = feedback.email?.trim() || null
  const replayUrl = feedback.postHogReplayUrl?.trim() || null
  const adminUrl = `${SITE_ORIGIN}/admin/collections/feedback-submissions/${encodeURIComponent(String(feedback.id))}`
  const textLines = [
    'New site feedback',
    '',
    feedback.comment,
    '',
    `Page: ${feedback.sourceUrl}`,
    `Submitted: ${submissionTime}`,
    ...(visitorEmail ? [`Visitor email: ${visitorEmail}`] : []),
    ...(replayUrl ? [`Session replay: ${replayUrl}`] : []),
    `Open in Payload: ${adminUrl}`,
  ]

  return {
    to: feedback.notificationRecipient,
    ...(visitorEmail ? { replyTo: visitorEmail } : {}),
    subject: 'New ev.church site feedback',
    text: textLines.join('\n'),
    html: [
      '<h1>New site feedback</h1>',
      `<p style="white-space:pre-wrap">${escapeHtml(feedback.comment)}</p>`,
      `<p><strong>Page:</strong> ${escapeHtml(feedback.sourceUrl)}<br>`,
      `<strong>Submitted:</strong> ${escapeHtml(submissionTime)}`,
      visitorEmail
        ? `<br><strong>Visitor email:</strong> ${escapeHtml(visitorEmail)}`
        : '',
      `</p><p>${replayUrl ? `<a href="${escapeHtml(replayUrl)}">View session replay</a> &middot; ` : ''}<a href="${escapeHtml(adminUrl)}">Open in Payload</a></p>`,
    ].join(''),
  }
}

export function sanitizeNotificationError(_error: unknown): string {
  return 'Notification delivery failed'
}

type ResendTransportOptions = {
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
}

type ResendResponse = { id?: unknown }

export function createResendSiteFeedbackTransport(
  options: ResendTransportOptions = {},
): SiteFeedbackNotificationTransport {
  const fetchImplementation = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return {
    async send(message, idempotencyKey) {
      const apiKey = process.env.RESEND_API_KEY?.trim()
      const from = process.env.SITE_FEEDBACK_EMAIL_FROM?.trim()
      if (!apiKey || !from) throw new Error('Notification provider is not configured')

      const response = await fetchImplementation(RESEND_EMAILS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          from,
          to: [message.to],
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      })

      let body: ResendResponse = {}
      try {
        body = (await response.json()) as ResendResponse
      } catch {
        // A status-only provider response is handled below without retaining its body.
      }

      if (!response.ok || typeof body.id !== 'string' || !body.id) {
        throw new Error('Notification provider rejected the request')
      }
      return { providerId: body.id }
    },
  }
}
