// @vitest-environment happy-dom

import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MemberNotificationsControl } from './MemberNotificationsControl'

const navigation = vi.hoisted(() => ({ pathname: '/sermons', search: '' }))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

function response(body: unknown, status = 200, headers?: Record<string, string>) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  }))
}

function available(actionableCount = 1, href = '/members/my-service#rock-schedule:one') {
  return {
    status: 'available',
    actionableCount,
    items: actionableCount > 0 ? [{
      id: 'rock-schedule:one',
      kind: 'rock-schedule-request',
      title: 'Welcome Team',
      summary: '9am · Main Auditorium',
      href,
      startsAt: '2026-08-23T09:00:00+12:00',
      requiresAction: true,
    }] : [],
    overflowHref: '/members/my-service',
    hasMore: false,
  }
}

describe('MemberNotificationsControl', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    navigation.pathname = '/sermons'
    navigation.search = ''
    vi.stubGlobal('fetch', vi.fn(() => response(available())))
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders an actionable count and provider-neutral My Service links', async () => {
    await act(async () => root.render(<MemberNotificationsControl tone="dark" />))
    await act(async () => Promise.resolve())

    const trigger = container.querySelector<HTMLButtonElement>('button[aria-controls]')!
    expect(trigger.getAttribute('aria-label')).toBe('Notifications, 1 action requiring attention')
    expect(trigger.textContent).toContain('1')

    await act(async () => trigger.click())
    await act(async () => Promise.resolve())

    expect(container.querySelector('[role="menu"]')).toBeNull()
    expect(container.querySelector('section[aria-label="Notifications"]')).not.toBeNull()
    expect(container.textContent).toContain('Welcome Team')
    expect(container.querySelector('a[href="/members/my-service#rock-schedule:one"]')).not.toBeNull()
    expect(container.querySelector('a[href="/members/my-service"]')?.textContent).toContain('View My Service')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('shows an empty state without a badge', async () => {
    vi.mocked(fetch).mockImplementation(() => response(available(0)))
    await act(async () => root.render(<MemberNotificationsControl />))
    await act(async () => Promise.resolve())

    const trigger = container.querySelector<HTMLButtonElement>('button[aria-controls]')!
    expect(trigger.getAttribute('aria-label')).toBe('Notifications, 0 actions requiring attention')
    expect(trigger.querySelector('span')).toBeNull()
    await act(async () => trigger.click())
    await act(async () => Promise.resolve())
    expect(container.textContent).toContain('Nothing needs your attention right now.')
  })

  it('offers recovery for auth and provider failures', async () => {
    vi.mocked(fetch).mockImplementation(() => response({ status: 'auth-required' }, 401))
    await act(async () => root.render(<MemberNotificationsControl />))
    await act(async () => Promise.resolve())
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-controls]')!.click())
    await act(async () => Promise.resolve())
    expect(container.querySelector('a[href^="/auth/login?returnTo="]')).not.toBeNull()

    vi.mocked(fetch).mockImplementation(() => response({
      status: 'unavailable', actionableCount: 0, items: [],
      overflowHref: '/members/my-service', hasMore: false,
    }, 503, { 'Retry-After': '1' }))
    await act(async () => root.render(<MemberNotificationsControl key="failure" />))
    await act(async () => Promise.resolve())
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-controls]')!.click())
    expect(container.textContent).toContain('Notifications are unavailable right now.')
    expect(container.querySelector('button')?.textContent).not.toContain('Welcome Team')
  })

  it('rejects unsafe destinations instead of rendering stale actionable links', async () => {
    vi.mocked(fetch).mockImplementation(() => response(available(1, 'https://evil.example/respond')))
    await act(async () => root.render(<MemberNotificationsControl />))
    await act(async () => Promise.resolve())
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-controls]')!.click())
    await act(async () => Promise.resolve())

    expect(container.querySelector('a[href="https://evil.example/respond"]')).toBeNull()
    expect(container.textContent).toContain('Notifications are unavailable right now.')
  })

  it('queues one fresh open read behind an in-flight background read', async () => {
    const resolvers: Array<(value: Response) => void> = []
    vi.mocked(fetch).mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)))
    await act(async () => root.render(<MemberNotificationsControl />))
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-controls]')!
    await act(async () => trigger.click())
    expect(resolvers).toHaveLength(1)

    await act(async () => resolvers[0]?.(await response(available(1))))
    expect(resolvers).toHaveLength(2)
    await act(async () => resolvers[1]?.(await response(available(0))))
    expect(trigger.getAttribute('aria-label')).toContain('0 actions')
    expect(container.textContent).not.toContain('Welcome Team')
  })

  it('drops a queued refresh when the control unmounts', async () => {
    const resolvers: Array<(value: Response) => void> = []
    vi.mocked(fetch).mockImplementation(() => new Promise((resolve) => resolvers.push(resolve)))
    await act(async () => root.render(<MemberNotificationsControl />))
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-controls]')!.click())
    expect(resolvers).toHaveLength(1)

    await act(async () => root.unmount())
    root = createRoot(container)
    await act(async () => resolvers[0]?.(await response(available())))

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('starts a replacement read after Strict Mode cleanup aborts the first read', async () => {
    let requestCount = 0
    vi.mocked(fetch).mockImplementation((_input, init) => new Promise<Response>((resolve, reject) => {
      requestCount += 1
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      if (requestCount === 2 && !init?.signal?.aborted) resolve(new Response(JSON.stringify(available(0)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
    }))

    await act(async () => root.render(
      <StrictMode>
        <MemberNotificationsControl />
      </StrictMode>,
    ))
    await act(async () => Promise.resolve())

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(container.querySelector<HTMLButtonElement>('button[aria-controls]')?.getAttribute('aria-label'))
      .toContain('0 actions')
  })

  it('honors Retry-After even when a provider error body is not JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('temporarily unavailable', {
      status: 503,
      headers: { 'Retry-After': '2' },
    }))
    await act(async () => root.render(<MemberNotificationsControl />))
    await act(async () => Promise.resolve())
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-controls]')!.click())

    const retry = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Try again'))
    expect(retry?.disabled).toBe(true)
  })

  it('applies the default retry cooldown when the network request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('network failed'))
    await act(async () => root.render(<MemberNotificationsControl />))
    await act(async () => Promise.resolve())
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-controls]')!.click())

    const retry = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Try again'))
    expect(retry?.disabled).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape and outside press, restoring trigger focus for Escape', async () => {
    await act(async () => root.render(<MemberNotificationsControl />))
    await act(async () => Promise.resolve())
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-controls]')!

    await act(async () => trigger.click())
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)

    await act(async () => trigger.click())
    await act(async () => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('refreshes on visible focus and only refreshes stale route changes', async () => {
    let now = 1_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    await act(async () => root.render(<MemberNotificationsControl />))
    await act(async () => Promise.resolve())
    expect(fetch).toHaveBeenCalledTimes(1)

    navigation.pathname = '/events'
    now += 59_000
    await act(async () => root.render(<MemberNotificationsControl />))
    expect(fetch).toHaveBeenCalledTimes(1)

    navigation.pathname = '/members'
    now += 2_000
    await act(async () => root.render(<MemberNotificationsControl />))
    await act(async () => Promise.resolve())
    expect(fetch).toHaveBeenCalledTimes(2)

    await act(async () => window.dispatchEvent(new Event('focus')))
    await act(async () => Promise.resolve())
    expect(fetch).toHaveBeenCalledTimes(2)

    now += 751
    await act(async () => window.dispatchEvent(new Event('focus')))
    await act(async () => Promise.resolve())
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('refreshes immediately after a member responds to a notification', async () => {
    await act(async () => root.render(<MemberNotificationsControl />))
    await act(async () => Promise.resolve())
    expect(fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      window.dispatchEvent(new Event('member-notifications:refresh'))
      await Promise.resolve()
    })

    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('uses a viewport-contained, scroll-bounded panel with touch-sized controls', async () => {
    await act(async () => root.render(<MemberNotificationsControl />))
    await act(async () => Promise.resolve())
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-controls]')!
    expect(trigger.className).toContain('min-h-11')
    await act(async () => trigger.click())
    await act(async () => Promise.resolve())
    const panel = container.querySelector<HTMLElement>('section[aria-label="Notifications"]')!
    expect(panel.className).toContain('inset-x-3')
    expect(panel.querySelector('.overflow-y-auto')).not.toBeNull()
  })
})
