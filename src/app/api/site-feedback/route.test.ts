import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SiteFeedbackRateLimitError } from '@/lib/site-feedback/rate-limit'
import { MAX_FEEDBACK_COMMENT_LENGTH } from '@/lib/site-feedback/validation'
import { TurnstileVerificationError } from '@/lib/turnstile'

const { verifyTurnstileToken } = vi.hoisted(() => ({
  verifyTurnstileToken: vi.fn(),
}))

vi.mock('@/lib/turnstile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/turnstile')>()),
  verifyTurnstileToken,
}))

import * as routeModule from './route'
import {
  handleSiteFeedbackPost,
  SITE_FEEDBACK_TURNSTILE_ACTION,
} from './route'

function request(
  body: unknown,
  headers: Record<string, string> = {},
  rawBody?: string,
) {
  return new NextRequest('https://www.ev.church/api/site-feedback', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://www.ev.church',
      'cf-connecting-ip': '203.0.113.1',
      'user-agent': 'Feedback Browser',
      ...headers,
    },
    body: rawBody ?? JSON.stringify(body),
  })
}

function streamedRequest(chunks: string[], onCancel = vi.fn()) {
  const encoder = new TextEncoder()
  let index = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index++]
      if (chunk === undefined) {
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(chunk))
    },
    cancel: onCancel,
  })

  const init = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://www.ev.church',
      'cf-connecting-ip': '203.0.113.1',
    },
    body,
    duplex: 'half' as const,
  }

  return {
    cancel: onCancel,
    request: new NextRequest('https://www.ev.church/api/site-feedback', init),
  }
}

function valid(overrides: Record<string, unknown> = {}) {
  return {
    comment: '  Please make campus filters easier to find.  ',
    email: '  visitor@example.com  ',
    sourceUrl: 'https://www.ev.church/events?campus=central',
    website: '',
    turnstileToken: 'visitor-token',
    postHogReplayUrl:
      'https://us.posthog.com/project/test-token/replay/019ff7cd-46fd-725b-9590-cfceaf201eb3?t=42',
    ...overrides,
  }
}

function dependencies() {
  const afterResponseTasks: Array<() => Promise<void>> = []
  return {
    rateLimitStore: { increment: vi.fn().mockResolvedValue(1) },
    createFeedback: vi.fn().mockResolvedValue({ id: 42, shouldNotify: true }),
    queueNotification: vi.fn().mockResolvedValue(undefined),
    logNotificationFailure: vi.fn(),
    scheduleAfterResponse: vi.fn((task: () => Promise<void>) => {
      afterResponseTasks.push(task)
    }),
    runAfterResponseTasks: () => Promise.all(afterResponseTasks.map((task) => task())),
  }
}

describe('site feedback route', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RAILWAY_PUBLIC_DOMAIN', 'www.ev.church')
    vi.stubEnv('SITE_FEEDBACK_RATE_LIMIT_SECRET', 'a'.repeat(32))
    vi.stubEnv('SITE_FEEDBACK_TRUST_CF_CONNECTING_IP', 'true')
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_UI_HOST', 'https://us.posthog.com')
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'test-token')
    verifyTurnstileToken.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('creates one private Payload document after every guard passes', async () => {
    const deps = dependencies()
    const response = await handleSiteFeedbackPost(request(valid()), deps)

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(verifyTurnstileToken).toHaveBeenCalledWith({
      token: 'visitor-token',
      remoteIp: '203.0.113.1',
      expectedHostname: 'www.ev.church',
      expectedAction: SITE_FEEDBACK_TURNSTILE_ACTION,
    })
    expect(deps.createFeedback).toHaveBeenCalledWith({
      comment: 'Please make campus filters easier to find.',
      email: 'visitor@example.com',
      sourceUrl: 'https://www.ev.church/events?campus=central',
      postHogSessionId: '019ff7cd-46fd-725b-9590-cfceaf201eb3',
      postHogReplayUrl:
        'https://us.posthog.com/project/test-token/replay/019ff7cd-46fd-725b-9590-cfceaf201eb3?t=42',
      clientAddressDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      userAgent: 'Feedback Browser',
    })
    expect(deps.rateLimitStore.increment.mock.invocationCallOrder[0]).toBeLessThan(
      verifyTurnstileToken.mock.invocationCallOrder[0],
    )
    expect(verifyTurnstileToken.mock.invocationCallOrder[0]).toBeLessThan(
      deps.createFeedback.mock.invocationCallOrder[0],
    )
    expect(deps.scheduleAfterResponse).toHaveBeenCalledOnce()
    expect(deps.queueNotification).not.toHaveBeenCalled()
    await deps.runAfterResponseTasks()
    expect(deps.queueNotification).toHaveBeenCalledWith(42)
  })

  it.each([
    ['missing origin', {}, { origin: '' }],
    ['cross origin', valid(), { origin: 'https://evil.test' }],
    [
      'non-JSON content',
      valid(),
      { 'content-type': 'application/x-www-form-urlencoded' },
    ],
    ['cross-origin source', valid({ sourceUrl: 'https://evil.test/' }), {}],
    ['blank comment', valid({ comment: '  ' }), {}],
    ['missing email', valid({ email: undefined }), {}],
    ['blank email', valid({ email: '   ' }), {}],
    ['invalid email', valid({ email: 'bad' }), {}],
    ['honeypot', valid({ website: 'spam' }), {}],
    [
      'oversized comment',
      valid({ comment: 'x'.repeat(MAX_FEEDBACK_COMMENT_LENGTH + 1) }),
      {},
    ],
  ])('rejects %s before persistence', async (_name, body, headers) => {
    const deps = dependencies()
    const response = await handleSiteFeedbackPost(
      request(body, headers as Record<string, string>),
      deps,
    )

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(deps.createFeedback).not.toHaveBeenCalled()
  })

  it('rejects malformed and oversized JSON before rate limiting or persistence', async () => {
    const malformedDeps = dependencies()
    const malformed = await handleSiteFeedbackPost(
      request({}, {}, '{not-json'),
      malformedDeps,
    )
    expect(malformed.status).toBe(400)
    expect(malformedDeps.rateLimitStore.increment).not.toHaveBeenCalled()

    const oversizedDeps = dependencies()
    const oversized = await handleSiteFeedbackPost(
      request(valid(), { 'content-length': '999999' }),
      oversizedDeps,
    )
    expect(oversized.status).toBe(413)
    expect(oversizedDeps.rateLimitStore.increment).not.toHaveBeenCalled()
    expect(oversizedDeps.createFeedback).not.toHaveBeenCalled()
  })

  it('accepts chunked JSON without a content-length header', async () => {
    const deps = dependencies()
    const serialized = JSON.stringify(valid())
    const streamed = streamedRequest([
      serialized.slice(0, 17),
      serialized.slice(17, 53),
      serialized.slice(53),
    ])

    const response = await handleSiteFeedbackPost(streamed.request, deps)

    expect(streamed.request.headers.has('content-length')).toBe(false)
    expect(response.status).toBe(201)
    expect(streamed.cancel).not.toHaveBeenCalled()
    expect(deps.createFeedback).toHaveBeenCalledOnce()
  })

  it('cancels a chunked body as soon as it exceeds the byte limit', async () => {
    const deps = dependencies()
    const streamed = streamedRequest([
      '{"comment":"',
      'x'.repeat(32_768),
      '","sourceUrl":"https://www.ev.church/"}',
    ])

    const response = await handleSiteFeedbackPost(streamed.request, deps)

    expect(response.status).toBe(413)
    expect(streamed.cancel).toHaveBeenCalledOnce()
    expect(deps.rateLimitStore.increment).not.toHaveBeenCalled()
    expect(deps.createFeedback).not.toHaveBeenCalled()
  })

  it('returns Retry-After when the rate limit is exhausted', async () => {
    const deps = dependencies()
    deps.rateLimitStore.increment.mockRejectedValue(
      new SiteFeedbackRateLimitError(37),
    )

    const response = await handleSiteFeedbackPost(request(valid()), deps)

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('37')
    expect(verifyTurnstileToken).not.toHaveBeenCalled()
    expect(deps.createFeedback).not.toHaveBeenCalled()
  })

  it('fails closed when rate-limit storage is unavailable', async () => {
    const deps = dependencies()
    deps.rateLimitStore.increment.mockRejectedValue(
      new Error('database unavailable'),
    )

    const response = await handleSiteFeedbackPost(request(valid()), deps)

    expect(response.status).toBe(503)
    expect(verifyTurnstileToken).not.toHaveBeenCalled()
    expect(deps.createFeedback).not.toHaveBeenCalled()
  })

  it('fails closed when Turnstile rejects or expires', async () => {
    const deps = dependencies()
    verifyTurnstileToken.mockRejectedValue(
      new TurnstileVerificationError('The bot check expired'),
    )

    const response = await handleSiteFeedbackPost(request(valid()), deps)

    expect(response.status).toBe(400)
    expect(deps.createFeedback).not.toHaveBeenCalled()
  })

  it('returns unavailable without leaking persistence errors', async () => {
    const deps = dependencies()
    deps.createFeedback.mockRejectedValue(new Error('secret database details'))

    const response = await handleSiteFeedbackPost(request(valid()), deps)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Unable to submit feedback right now',
    })
  })

  it('keeps the successful response when notification enqueueing fails', async () => {
    const deps = dependencies()
    deps.queueNotification.mockRejectedValue(
      new Error('visitor@example.com: provider credentials secret'),
    )

    const response = await handleSiteFeedbackPost(request(valid()), deps)

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(deps.logNotificationFailure).not.toHaveBeenCalled()
    await deps.runAfterResponseTasks()
    expect(deps.logNotificationFailure).toHaveBeenCalledOnce()
    expect(JSON.stringify(deps.logNotificationFailure.mock.calls)).not.toContain(
      'visitor@example.com',
    )
    expect(JSON.stringify(deps.logNotificationFailure.mock.calls)).not.toContain(
      'provider credentials secret',
    )
  })

  it('returns success without waiting for notification enqueueing', async () => {
    const deps = dependencies()
    let resolveQueue: (() => void) | undefined
    deps.queueNotification.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveQueue = resolve
      }),
    )

    const response = await handleSiteFeedbackPost(request(valid()), deps)

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(deps.queueNotification).not.toHaveBeenCalled()
    resolveQueue?.()
  })

  it('does not queue when the snapshotted recipient is blank', async () => {
    const deps = dependencies()
    deps.createFeedback.mockResolvedValue({ id: 42, shouldNotify: false })

    const response = await handleSiteFeedbackPost(request(valid()), deps)

    expect(response.status).toBe(201)
    expect(deps.queueNotification).not.toHaveBeenCalled()
    expect(deps.scheduleAfterResponse).not.toHaveBeenCalled()
  })

  it('supports independent valid requests without sharing persistence state', async () => {
    const first = dependencies()
    const second = dependencies()

    const [firstResponse, secondResponse] = await Promise.all([
      handleSiteFeedbackPost(request(valid()), first),
      handleSiteFeedbackPost(
        request(valid({ comment: 'A separate visitor request.' }), {
          'cf-connecting-ip': '203.0.113.2',
        }),
        second,
      ),
    ])

    expect([firstResponse.status, secondResponse.status]).toEqual([201, 201])
    expect(first.createFeedback).toHaveBeenCalledTimes(1)
    expect(second.createFeedback).toHaveBeenCalledTimes(1)
  })

  it('does not export a public GET handler', () => {
    expect(routeModule).not.toHaveProperty('GET')
  })
})
