import { after, NextRequest, NextResponse } from 'next/server'

import { getPayloadClient } from '@/lib/payload'
import { isSameOriginRequest } from '@/lib/request-origin'
import { SITE_FEEDBACK_TURNSTILE_ACTION } from '@/lib/site-feedback/constants'
import {
  createPostgresSiteFeedbackRateLimitStore,
  digestSiteFeedbackClientAddress,
  enforceSiteFeedbackRateLimit,
  SiteFeedbackRateLimitError,
  trustedSiteFeedbackClientAddress,
  type SiteFeedbackRateLimitStore,
} from '@/lib/site-feedback/rate-limit'
import {
  SiteFeedbackValidationError,
  validateSiteFeedbackSubmission,
} from '@/lib/site-feedback/validation'
import {
  TurnstileVerificationError,
  verifyTurnstileToken,
} from '@/lib/turnstile'
import { sanitizeNotificationError } from '@/lib/site-feedback/notification'
import {
  SEND_SITE_FEEDBACK_NOTIFICATION_TASK,
  SITE_FEEDBACK_NOTIFICATION_QUEUE,
} from '@/jobs/site-feedback-notification'

export { SITE_FEEDBACK_TURNSTILE_ACTION }

const MAX_REQUEST_BYTES = 32_768
const MAX_USER_AGENT_LENGTH = 512
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' }

type FeedbackData = {
  comment: string
  email: string
  sourceUrl: string
  postHogSessionId?: string
  postHogReplayUrl?: string
  clientAddressDigest: string
  userAgent?: string
}

type SiteFeedbackRouteDependencies = {
  rateLimitStore: SiteFeedbackRateLimitStore
  createFeedback(
    data: FeedbackData,
  ): Promise<{ id: number | string; shouldNotify: boolean }>
  queueNotification(feedbackId: number | string): Promise<void>
  logNotificationFailure(): void
  scheduleAfterResponse(task: () => Promise<void>): void
}

class RequestTooLargeError extends Error {}

function json(value: unknown, status: number, headers?: Record<string, string>) {
  return NextResponse.json(value, {
    status,
    headers: { ...NO_STORE, ...headers },
  })
}

function error(message: string, status: number, headers?: Record<string, string>) {
  return json({ error: message }, status, headers)
}

function isJsonRequest(request: NextRequest): boolean {
  return (
    request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ===
    'application/json'
  )
}

async function boundedJson(request: NextRequest): Promise<unknown> {
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const declared = Number(contentLength)
    if (!Number.isSafeInteger(declared) || declared < 0) {
      throw new SiteFeedbackValidationError()
    }
    if (declared > MAX_REQUEST_BYTES) throw new RequestTooLargeError()
  }

  if (!request.body) throw new SiteFeedbackValidationError()

  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let receivedBytes = 0
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      receivedBytes += value.byteLength
      if (receivedBytes > MAX_REQUEST_BYTES) {
        try {
          await reader.cancel()
        } catch {
          // The size violation remains authoritative if cancellation fails.
        }
        throw new RequestTooLargeError()
      }
      text += decoder.decode(value, { stream: true })
    }
    text += decoder.decode()
  } catch (caught) {
    if (caught instanceof RequestTooLargeError) throw caught
    throw new SiteFeedbackValidationError()
  } finally {
    reader.releaseLock()
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new SiteFeedbackValidationError()
  }
}

function expectedHostname(): string | null {
  return process.env.NODE_ENV === 'production'
    ? process.env.RAILWAY_PUBLIC_DOMAIN || null
    : null
}

async function createFeedback(
  data: FeedbackData,
): Promise<{ id: number | string; shouldNotify: boolean }> {
  const payload = await getPayloadClient()
  let settings: {
    feedback?: { notificationRecipient?: null | string } | null
  } | null = null
  let settingsAvailable = true
  try {
    settings = await payload.findGlobal({
      slug: 'site-settings',
      depth: 0,
      overrideAccess: true,
      select: { feedback: { notificationRecipient: true } },
    })
  } catch {
    settingsAvailable = false
    payload.logger.error(
      '[SiteFeedback] Notification recipient unavailable while saving feedback',
    )
  }
  const configuredRecipient = settings?.feedback?.notificationRecipient
  const notificationRecipient =
    typeof configuredRecipient === 'string' && configuredRecipient.trim()
      ? configuredRecipient.trim()
      : null
  const now = new Date().toISOString()
  const feedback = await payload.create({
    collection: 'feedback-submissions',
    data: {
      ...data,
      resolutionStatus: 'new',
      notificationStatus: settingsAvailable
        ? notificationRecipient
          ? 'pending'
          : 'disabled'
        : 'failed',
      notificationRecipient,
      notificationAttemptCount: 0,
      notificationWindowStartedAt: notificationRecipient ? now : null,
      notificationError: settingsAvailable
        ? null
        : 'Notification recipient unavailable',
    },
    overrideAccess: true,
  })
  return { id: feedback.id, shouldNotify: Boolean(notificationRecipient) }
}

async function queueNotification(feedbackId: number | string): Promise<void> {
  const payload = await getPayloadClient()
  await payload.jobs.queue({
    task: SEND_SITE_FEEDBACK_NOTIFICATION_TASK,
    input: { feedbackId: Number(feedbackId) },
    queue: SITE_FEEDBACK_NOTIFICATION_QUEUE,
    overrideAccess: true,
  })
}

function logNotificationFailure(): void {
  void getPayloadClient()
    .then((payload) =>
      payload.logger.error(
        `[SiteFeedback] ${sanitizeNotificationError(undefined)} while queueing`,
      ),
    )
    .catch(() => {
      // Feedback persistence remains authoritative even if logging is unavailable.
    })
}

const defaultDependencies: SiteFeedbackRouteDependencies = {
  rateLimitStore: createPostgresSiteFeedbackRateLimitStore(),
  createFeedback,
  queueNotification,
  logNotificationFailure,
  scheduleAfterResponse: after,
}

export async function handleSiteFeedbackPost(
  request: NextRequest,
  dependencies: SiteFeedbackRouteDependencies = defaultDependencies,
) {
  try {
    if (!isSameOriginRequest(request)) {
      return error('Invalid request origin', 403)
    }
    if (!isJsonRequest(request)) return error('Invalid request', 415)

    const body = await boundedJson(request)
    const trustedOrigin = request.headers.get('origin') as string
    const submission = validateSiteFeedbackSubmission(body, trustedOrigin)
    const address = trustedSiteFeedbackClientAddress(request.headers)

    await enforceSiteFeedbackRateLimit({
      address,
      store: dependencies.rateLimitStore,
    })
    await verifyTurnstileToken({
      token: submission.turnstileToken,
      remoteIp: address,
      expectedHostname: expectedHostname(),
      expectedAction: SITE_FEEDBACK_TURNSTILE_ACTION,
    })

    const userAgent = request.headers
      .get('user-agent')
      ?.trim()
      .slice(0, MAX_USER_AGENT_LENGTH)
    const createdFeedback = await dependencies.createFeedback({
      comment: submission.comment,
      email: submission.email,
      sourceUrl: submission.sourceUrl,
      ...(submission.postHogSessionId && submission.postHogReplayUrl
        ? {
            postHogSessionId: submission.postHogSessionId,
            postHogReplayUrl: submission.postHogReplayUrl,
          }
        : {}),
      clientAddressDigest: digestSiteFeedbackClientAddress(address),
      ...(userAgent ? { userAgent } : {}),
    })

    if (createdFeedback.shouldNotify) {
      dependencies.scheduleAfterResponse(async () => {
        try {
          await dependencies.queueNotification(createdFeedback.id)
        } catch {
          dependencies.logNotificationFailure()
        }
      })
    }

    return json({ ok: true }, 201)
  } catch (caught) {
    if (caught instanceof RequestTooLargeError) {
      return error('Invalid request', 413)
    }
    if (caught instanceof SiteFeedbackValidationError) {
      return error(caught.message, 400)
    }
    if (caught instanceof SiteFeedbackRateLimitError) {
      return error('Too many requests', 429, {
        'Retry-After': String(caught.retryAfterSeconds),
      })
    }
    if (caught instanceof TurnstileVerificationError) {
      return error(caught.message, 400)
    }
    return error('Unable to submit feedback right now', 503)
  }
}

export async function POST(request: NextRequest) {
  return handleSiteFeedbackPost(request)
}
