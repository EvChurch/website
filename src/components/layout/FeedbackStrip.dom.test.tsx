// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PublicSiteFeedbackSettings } from '@/lib/site-feedback/settings'
import { FeedbackStrip } from './FeedbackStrip'

const posthog = vi.hoisted(() => ({
  get_session_replay_url: vi.fn(() =>
    'https://us.posthog.com/project/test-token/replay/019ff7cd-46fd-725b-9590-cfceaf201eb3?t=42',
  ),
}))

vi.mock('posthog-js', () => ({ default: posthog }))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/components/forms/TurnstileWidget', () => ({
  TurnstileWidget: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken('verified-token')}>
      Complete security check
    </button>
  ),
}))

const settings: PublicSiteFeedbackSettings = {
  bannerCopy: 'Help us improve the new ev.church.',
  ctaLabel: 'Share feedback.',
  modalTitle: 'Share your feedback',
  modalIntro: 'Tell us what is working well or what we could improve.',
  dismissalVersion: 'v1',
  turnstileSiteKey: 'site-key',
}

describe('FeedbackStrip modal', () => {
  let container: HTMLDivElement
  let root: Root | null

  beforeEach(() => {
    posthog.get_session_replay_url.mockReturnValue(
      'https://us.posthog.com/project/test-token/replay/019ff7cd-46fd-725b-9590-cfceaf201eb3?t=42',
    )
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    history.replaceState(null, '', '/visit?campus=north')
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    container.remove()
    document.documentElement.style.overflow = ''
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  async function open() {
    await act(async () =>
      root?.render(<FeedbackStrip settings={settings} onDismiss={() => undefined} />),
    )
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[data-feedback-trigger]',
    )!
    await act(async () => trigger.click())
    return trigger
  }

  it('uses prominent close icons with touch-sized controls', async () => {
    await open()

    const dismiss = container.querySelector<HTMLButtonElement>(
      '[aria-label="Dismiss feedback prompt"]',
    )!
    const close = container.querySelector<HTMLButtonElement>(
      '[aria-label="Close feedback dialog"]',
    )!

    expect(dismiss.className).toContain('h-11')
    expect(dismiss.querySelector('span')?.className).toContain('text-2xl')
    expect(close.className).toContain('h-11')
    expect(close.querySelector('span')?.className).toContain('text-3xl')
    expect(container.querySelector('h2')?.className).toContain('pr-14')
  })

  async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
    await act(async () => {
      const prototype = element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value)
      element.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('opens a labelled dialog, closes with Escape, restores focus, and unlocks scroll', async () => {
    const trigger = await open()
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.activeElement).toBe(
      container.querySelector<HTMLTextAreaElement>('textarea[name="comment"]'),
    )

    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.documentElement.style.overflow).toBe('')
    expect(document.activeElement).toBe(trigger)
  })

  it('submits one valid payload and keeps the thank-you inside the modal', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await open()

    const comment = container.querySelector<HTMLTextAreaElement>('textarea[name="comment"]')!
    const email = container.querySelector<HTMLInputElement>('input[name="email"]')!
    await type(comment, 'The campus information was easy to find.')
    await type(email, 'visitor@example.com')
    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button[type="button"]'))
        .find((button) => button.textContent?.includes('Complete security check'))!
        .click()
    })
    await act(async () => container.querySelector<HTMLFormElement>('form')!.requestSubmit())

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(
      '/api/site-feedback',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          comment: 'The campus information was easy to find.',
          email: 'visitor@example.com',
          sourceUrl: 'http://localhost:3000/visit?campus=north',
          postHogReplayUrl:
            'https://us.posthog.com/project/test-token/replay/019ff7cd-46fd-725b-9590-cfceaf201eb3?t=42',
          website: '',
          turnstileToken: 'verified-token',
        }),
      }),
    )
    expect(container.textContent).toContain('Thank you for your feedback')
    expect(container.querySelector('form')).toBeNull()
    expect(posthog.get_session_replay_url).toHaveBeenCalledWith({
      withTimestamp: true,
    })
  })

  it('requires an email address before submitting', async () => {
    await open()

    const email = container.querySelector<HTMLInputElement>('input[name="email"]')!
    expect(email.required).toBe(true)
    expect(email.labels?.[0]?.textContent).toBe('Email')
  })

  it('hides email and submits the signed-in member email', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await act(async () =>
      root?.render(
        <FeedbackStrip
          settings={settings}
          signedInEmail="aroha@example.com"
          onDismiss={() => undefined}
        />,
      ),
    )
    await act(async () =>
      container.querySelector<HTMLButtonElement>('button[data-feedback-trigger]')!.click(),
    )

    expect(container.querySelector('input[name="email"]')).toBeNull()
    await type(
      container.querySelector<HTMLTextAreaElement>('textarea[name="comment"]')!,
      'The page was helpful.',
    )
    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button[type="button"]'))
        .find((button) => button.textContent?.includes('Complete security check'))!
        .click()
    })
    await act(async () => container.querySelector<HTMLFormElement>('form')!.requestSubmit())

    const [, request] = vi.mocked(fetch).mock.calls[0]
    expect(JSON.parse(String(request?.body))).toMatchObject({
      email: 'aroha@example.com',
    })
  })

  it('retains input and shows retryable server and network errors', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await open()
    const comment = container.querySelector<HTMLTextAreaElement>('textarea[name="comment"]')!
    await type(comment, 'Please improve search.')
    await type(container.querySelector<HTMLInputElement>('input[name="email"]')!, 'visitor@example.com')
    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button[type="button"]'))
        .find((button) => button.textContent?.includes('Complete security check'))!
        .click()
    })
    await act(async () => container.querySelector<HTMLFormElement>('form')!.requestSubmit())
    expect(container.textContent).toContain('Too many requests')
    expect(comment.value).toBe('Please improve search.')
    expect(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled,
    ).toBe(false)
    expect(container.textContent).not.toContain('Thank you for your feedback')
  })

  it('submits feedback without replay metadata when PostHog has no session', async () => {
    posthog.get_session_replay_url.mockReturnValue('')
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await open()
    await type(
      container.querySelector<HTMLTextAreaElement>('textarea[name="comment"]')!,
      'The page was helpful.',
    )
    await type(container.querySelector<HTMLInputElement>('input[name="email"]')!, 'visitor@example.com')
    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button[type="button"]'))
        .find((button) => button.textContent?.includes('Complete security check'))!
        .click()
    })
    await act(async () => container.querySelector<HTMLFormElement>('form')!.requestSubmit())

    const [, request] = vi.mocked(fetch).mock.calls[0]
    expect(JSON.parse(String(request?.body))).toEqual(
      expect.not.objectContaining({
        postHogReplayUrl: expect.anything(),
      }),
    )
    expect(container.textContent).toContain('Thank you for your feedback')
  })

  it('honors Retry-After and disables resubmission until the cooldown elapses', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-12T00:00:00Z'))
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '2',
        },
      }),
    )
    await open()
    await type(
      container.querySelector<HTMLTextAreaElement>('textarea[name="comment"]')!,
      'Please improve search.',
    )
    await type(container.querySelector<HTMLInputElement>('input[name="email"]')!, 'visitor@example.com')
    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button[type="button"]'))
        .find((button) => button.textContent?.includes('Complete security check'))!
        .click()
    })
    await act(async () => container.querySelector<HTMLFormElement>('form')!.requestSubmit())

    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(container.textContent).toContain('Try again in 2 seconds')
    expect(submit.disabled).toBe(true)

    await act(async () => vi.advanceTimersByTime(1_000))
    await act(async () => vi.advanceTimersByTime(1_000))
    expect(submit.disabled).toBe(false)
    vi.useRealTimers()
  })

  it('accepts an HTTP-date Retry-After value', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-12T00:00:00Z'))
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many requests' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': 'Wed, 12 Aug 2026 00:00:03 GMT',
        },
      }),
    )
    await open()
    await type(
      container.querySelector<HTMLTextAreaElement>('textarea[name="comment"]')!,
      'Please improve search.',
    )
    await type(container.querySelector<HTMLInputElement>('input[name="email"]')!, 'visitor@example.com')
    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button[type="button"]'))
        .find((button) => button.textContent?.includes('Complete security check'))!
        .click()
    })
    await act(async () => container.querySelector<HTMLFormElement>('form')!.requestSubmit())

    expect(container.textContent).toContain('Try again in 3 seconds')
    expect(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled,
    ).toBe(true)
  })

  it('times out after 45 seconds, preserves input, and aborts the request', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    vi.mocked(fetch).mockImplementation((_input, init) => {
      signal = init?.signal as AbortSignal
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        )
      })
    })
    await open()
    const comment = container.querySelector<HTMLTextAreaElement>('textarea[name="comment"]')!
    await type(comment, 'Keep this feedback safe.')
    await type(container.querySelector<HTMLInputElement>('input[name="email"]')!, 'visitor@example.com')
    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button[type="button"]'))
        .find((button) => button.textContent?.includes('Complete security check'))!
        .click()
    })
    await act(async () => container.querySelector<HTMLFormElement>('form')!.requestSubmit())
    await act(async () => vi.advanceTimersByTime(45_000))

    expect(signal?.aborted).toBe(true)
    expect(container.textContent).toContain('The request took too long')
    expect(comment.value).toBe('Keep this feedback safe.')
    vi.useRealTimers()
  })

  it('aborts an in-flight submission when unmounted', async () => {
    let signal: AbortSignal | undefined
    vi.mocked(fetch).mockImplementation((_input, init) => {
      signal = init?.signal as AbortSignal
      return new Promise(() => undefined)
    })
    await open()
    await type(
      container.querySelector<HTMLTextAreaElement>('textarea[name="comment"]')!,
      'Do not lose this.',
    )
    await type(container.querySelector<HTMLInputElement>('input[name="email"]')!, 'visitor@example.com')
    await act(async () => {
      Array.from(container.querySelectorAll<HTMLButtonElement>('button[type="button"]'))
        .find((button) => button.textContent?.includes('Complete security check'))!
        .click()
    })
    await act(async () => container.querySelector<HTMLFormElement>('form')!.requestSubmit())
    await act(async () => root?.unmount())
    root = null

    expect(signal?.aborted).toBe(true)
  })
})
