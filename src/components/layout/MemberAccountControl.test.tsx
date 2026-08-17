// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MemberAccountControl, type MemberDisplayProfile } from './MemberAccountControl'
import { Header } from './Header'

const navigation = vi.hoisted(() => ({
  pathname: '/sermons',
  search: 'campus=2',
}))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const member: MemberDisplayProfile = {
  name: 'Aroha Ngata',
  email: 'aroha@example.com',
  avatarUrl: '/member-avatar',
}

describe('MemberAccountControl', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    navigation.pathname = '/sermons'
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('renders a plain signed-out link with the current safe path', async () => {
    await act(async () => root.render(
      <MemberAccountControl profile={null} variant="desktop" tone="dark" />,
    ))

    const link = container.querySelector<HTMLAnchorElement>('a[aria-label="Sign in"]')
    expect(link?.getAttribute('href')).toBe(
      '/auth/login?returnTo=%2Fsermons%3Fcampus%3D2',
    )
    expect(link?.getAttribute('rel')).toBe('nofollow')
    expect(link?.className).toContain('min-h-10')
    expect(link?.hasAttribute('data-header-account-control')).toBe(true)
    expect(link?.querySelector('[data-member-sign-in-icon]')).not.toBeNull()
    expect(link?.querySelector('circle')).not.toBeNull()
    expect(container.textContent).not.toContain('Aroha')
  })

  it('offers Admin to exact admins even without a resolved Rock profile', async () => {
    await act(async () => root.render(
      <MemberAccountControl
        profile={null}
        variant="desktop"
        tone="dark"
        adminHref="/admin/impersonate"
      />,
    ))

    expect(container.querySelector('a[href="/admin/impersonate"]')?.textContent)
      .toContain('Admin')
    expect(container.querySelector('a[aria-label="Sign in"]')).toBeNull()
  })

  it('renders a hover menu for desktop and mobile-icon variants', async () => {
    await act(async () => root.render(
      <>
        <MemberAccountControl profile={member} variant="desktop" tone="dark" adminHref="/admin/impersonate" />
        <MemberAccountControl profile={member} variant="mobile-icon" tone="dark" adminHref="/admin/impersonate" />
      </>,
    ))

    // hover-trigger variants use aria-haspopup="true" (drawer uses "dialog")
    const hoverTriggers = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .filter((btn) => btn.getAttribute('aria-label')?.includes('Open account for'))
      .filter((btn) => btn.getAttribute('aria-haspopup') === 'true')
    expect(hoverTriggers).toHaveLength(2)
    expect(hoverTriggers.every((trigger) => trigger.hasAttribute('data-header-account-control')))
      .toBe(true)
    expect(hoverTriggers[0]?.getAttribute('aria-controls')).not.toBe(
      hoverTriggers[1]?.getAttribute('aria-controls'),
    )

    await act(async () => hoverTriggers[0]?.parentElement?.dispatchEvent(
      new MouseEvent('mouseover', { bubbles: true }),
    ))

    const menu = container.querySelector('[role="menu"]')
    expect(menu).not.toBeNull()
    expect(menu?.getAttribute('data-state')).toBe('open')
    expect(menu?.textContent).toContain('Aroha Ngata')
    expect(menu?.textContent).toContain('aroha@example.com')
    expect(menu?.querySelector('img')).not.toBeNull()
    expect(menu?.textContent).toContain('Overview')
    expect(menu?.textContent).toContain('Connect Group')
    expect(menu?.textContent).toContain('Admin')
    expect(menu?.textContent).toContain('Log out')
    expect(menu?.textContent).not.toContain('personId')
    expect(menu?.textContent).not.toContain('Auth0')
    expect(menu?.textContent).not.toContain('Open members')

    const links = [...(menu?.querySelectorAll<HTMLAnchorElement>('a') ?? [])]
      .map((link) => link.getAttribute('href'))
    expect(links).toContain('/members')
    expect(links).toContain('/members/connect-groups')
    expect(links).toContain('/admin/impersonate')
    expect(links.some(l => l?.startsWith('/auth/logout'))).toBe(true)
    const privateLinks = [...container.querySelectorAll<HTMLAnchorElement>(
      'a[href^="/auth/"], a[href="/members"], a[href^="/members/"]',
    )]
    expect(privateLinks).not.toHaveLength(0)
    expect(privateLinks.every((link) => link.rel === 'nofollow')).toBe(true)
  })

  it('closes hover menu on Escape key', async () => {
    await act(async () => root.render(
      <MemberAccountControl profile={member} variant="desktop" tone="dark" />,
    ))
    const trigger = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((btn) => btn.getAttribute('aria-label')?.includes('Open account for'))!

    // Click opens
    await act(async () => trigger.click())
    expect(container.querySelector('[role="menu"]')).not.toBeNull()

    // Escape closes and restores focus
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(container.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('closes hover menu on route change', async () => {
    await act(async () => root.render(
      <MemberAccountControl profile={member} variant="desktop" tone="dark" />,
    ))
    const trigger = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((btn) => btn.getAttribute('aria-label')?.includes('Open account for'))!

    // Open via click
    await act(async () => trigger.click())
    expect(container.querySelector('[role="menu"]')).not.toBeNull()

    // Route changes → menu closes (sync)
    navigation.pathname = '/events'
    await act(async () => root.render(
      <MemberAccountControl profile={member} variant="desktop" tone="dark" />,
    ))
    expect(container.querySelector('[role="menu"]')).toBeNull()
  })

  it('closes hover menu on outside pointer press', async () => {
    await act(async () => root.render(
      <MemberAccountControl profile={member} variant="desktop" tone="dark" />,
    ))
    const trigger = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((btn) => btn.getAttribute('aria-label')?.includes('Open account for'))!

    // Click opens
    await act(async () => trigger.click())
    expect(container.querySelector('[role="menu"]')).not.toBeNull()

    // Outside press closes
    await act(async () => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
    expect(container.querySelector('[role="menu"]')).toBeNull()
  })

  it('keeps the hover menu closed while the control is inactive', async () => {
    await act(async () => root.render(
      <MemberAccountControl profile={member} variant="mobile-icon" active />,
    ))
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Open account for Aroha Ngata"]',
    )!

    await act(async () => trigger.click())
    expect(container.querySelector('[role="menu"]')).not.toBeNull()

    await act(async () => root.render(
      <MemberAccountControl profile={member} variant="mobile-icon" active={false} />,
    ))
    expect(container.querySelector('[role="menu"]')).toBeNull()

    await act(async () => trigger.click())
    expect(container.querySelector('[role="menu"]')).toBeNull()
  })

  it('delays hover close and cancels it on re-entry', async () => {
    vi.useFakeTimers()

    try {
      await act(async () => root.render(
        <MemberAccountControl profile={member} variant="desktop" tone="dark" />,
      ))
      const account = container.querySelector<HTMLButtonElement>(
        'button[aria-label="Open account for Aroha Ngata"]',
      )!.parentElement!

      await act(async () => account.dispatchEvent(
        new MouseEvent('mouseover', { bubbles: true }),
      ))
      expect(container.querySelector('[role="menu"]')).not.toBeNull()

      await act(async () => account.dispatchEvent(
        new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }),
      ))
      await act(async () => vi.advanceTimersByTime(119))
      expect(container.querySelector('[role="menu"]')).not.toBeNull()

      await act(async () => account.dispatchEvent(
        new MouseEvent('mouseover', { bubbles: true }),
      ))
      await act(async () => vi.advanceTimersByTime(120))
      expect(container.querySelector('[role="menu"]')).not.toBeNull()

      await act(async () => account.dispatchEvent(
        new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }),
      ))
      await act(async () => vi.advanceTimersByTime(120))
      expect(container.querySelector('[role="menu"]')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders an in-place expandable area for drawer variant', async () => {
    await act(async () => root.render(
      <MemberAccountControl profile={member} variant="drawer" />,
    ))

    // Trigger has no aria-haspopup (it's an in-place toggle, not a popup)
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-expanded="false"]',
    )!
    expect(trigger).not.toBeNull()
    expect(trigger?.getAttribute('aria-haspopup')).toBeNull()
    expect(trigger?.textContent).toContain('Aroha Ngata')
    expect(trigger?.textContent).toContain('aroha@example.com')
    expect(trigger?.querySelector('img')).not.toBeNull()
    expect(trigger?.className).toContain('w-full')
    expect(trigger?.className).toContain('justify-between')
    // Chevron should be present
    expect(trigger?.querySelector('svg')).not.toBeNull()

    // Closed state: grid-rows-[0fr]
    const collapsedPanel = container.querySelector<HTMLDivElement>(
      '[data-state="closed"]',
    )!
    expect(collapsedPanel?.className).toContain('grid-rows-[0fr]')
    expect(collapsedPanel?.getAttribute('aria-hidden')).toBe('true')
    expect(collapsedPanel?.hasAttribute('inert')).toBe(true)

    // Click opens it
    await act(async () => trigger.click())
    const expandedPanel = container.querySelector<HTMLDivElement>(
      '[data-state="open"]',
    )!
    expect(expandedPanel?.className).toContain('grid-rows-[1fr]')
    expect(expandedPanel?.getAttribute('aria-hidden')).toBe('false')
    expect(expandedPanel?.hasAttribute('inert')).toBe(false)
    expect(trigger.textContent).toContain('Aroha Ngata')
    expect(trigger.textContent).toContain('aroha@example.com')
    expect(expandedPanel?.textContent).toContain('Overview')
    expect(expandedPanel?.textContent).toContain('Connect Group')
    expect(expandedPanel?.textContent).toContain('Log out')

    const links = [...(expandedPanel?.querySelectorAll<HTMLAnchorElement>('a') ?? [])]
      .map((link) => link.getAttribute('href'))
    expect(links).toContain('/members')
    expect(links).toContain('/members/connect-groups')
    expect(links.some(l => l?.startsWith('/auth/logout'))).toBe(true)
    const privateLinks = [...container.querySelectorAll<HTMLAnchorElement>(
      'a[href^="/auth/"], a[href="/members"], a[href^="/members/"]',
    )]
    expect(privateLinks).not.toHaveLength(0)
    expect(privateLinks.every((link) => link.rel === 'nofollow')).toBe(true)

    // active=false still closes
    await act(async () => root.render(
      <MemberAccountControl profile={member} variant="drawer" active={false} />,
    ))
    // Panel should still be in DOM but not expanded
    const closedAfterActive = container.querySelector<HTMLDivElement>(
      '[data-state="closed"]',
    )
    expect(closedAfterActive).not.toBeNull()
    expect(closedAfterActive?.getAttribute('aria-hidden')).toBe('true')
    expect(closedAfterActive?.hasAttribute('inert')).toBe(true)
  })

  it('falls back to initials when the member image fails', async () => {
    await act(async () => root.render(
      <MemberAccountControl profile={member} variant="desktop" tone="dark" />,
    ))
    const image = container.querySelector<HTMLImageElement>('img')!
    await act(async () => image.dispatchEvent(new Event('error')))
    expect(container.textContent).toContain('AN')
    expect(container.querySelector('[data-avatar-fallback]')).not.toBeNull()
  })

  it('uses a deterministic fallback colour for member initials', async () => {
    await act(async () => root.render(
      <>
        <MemberAccountControl profile={{ ...member, avatarUrl: null }} variant="desktop" tone="dark" />
        <MemberAccountControl profile={{ ...member, avatarUrl: null }} variant="mobile-icon" tone="dark" />
      </>,
    ))

    // Each hover variant renders 1 avatar in the trigger (menu header only renders when open)
    const fallbacks = [...container.querySelectorAll<HTMLElement>('[data-avatar-fallback]')]
    expect(fallbacks).toHaveLength(2)
    expect(fallbacks[0]?.className).toBe(fallbacks[1]?.className)
    expect(fallbacks[0]?.className).toContain('bg-connect-brown')
  })

  it('places account access after Give and in both mobile surfaces', async () => {
    await act(async () => root.render(<Header memberProfile={member} />))

    const give = container.querySelector<HTMLAnchorElement>('a[href="/give"]')!
    // Desktop trigger is after Give
    expect(give.nextElementSibling?.querySelector('button[aria-haspopup="true"]')).not.toBeNull()

    // 2 hover-menu triggers (desktop + mobile-icon) with aria-label
    const accountTriggers = container.querySelectorAll(
      'button[aria-label="Open account for Aroha Ngata"]',
    )
    expect(accountTriggers).toHaveLength(2)

    const hamburger = container.querySelector<HTMLButtonElement>('button[aria-label="Open menu"]')!
    // Mobile-icon (hover menu, aria-haspopup="true") is the previous sibling
    expect(hamburger.previousElementSibling?.querySelector('button[aria-haspopup="true"]')).not.toBeNull()

    // Drawer: find via aria-expanded + chevron SVG
    const drawerAccount = container.querySelector<HTMLButtonElement>(
      'button[aria-expanded="false"]',
    )!
    expect(drawerAccount).not.toBeNull()
    expect(drawerAccount?.querySelector('svg')).not.toBeNull()
    const planVisit = container.querySelector<HTMLAnchorElement>('a[href="/visit"].bg-rich-red')!
    expect(
      drawerAccount.compareDocumentPosition(planVisit) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0)
  })

  it('keeps Next Steps as a navigation group without linking to a removed page', async () => {
    await act(async () => root.render(<Header />))

    expect(container.querySelector('a[href="/next-steps"]')).toBeNull()
    expect(
      [...container.querySelectorAll('button')].some(
        (button) => button.textContent?.trim() === 'Next Steps',
      ),
    ).toBe(true)
    expect(container.querySelector('a[href="/explaining-christianity"]')).not.toBeNull()
  })

  it.each(['/daily-readings/16160', '/privacy', '/blog'])(
    'uses dark navigation at the top of the light page %s',
    async (pathname) => {
      navigation.pathname = pathname
      await act(async () => root.render(<Header />))

      expect(container.querySelector('header a[href="/events"]')?.className)
        .toContain('text-brand-black/80')
      expect(container.querySelector('header a[href="/give"]')?.className)
        .toContain('bg-rich-red')
      expect(container.querySelector('header button[aria-label="Open menu"]')?.className)
        .toContain('text-brand-black')
    },
  )

  it('uses white navigation over the member-area gradient', async () => {
    navigation.pathname = '/members/connect-groups/29043/attendance'
    await act(async () => root.render(<Header />))

    expect(container.querySelector('header a[href="/events"]')?.className)
      .toContain('text-white/90')
    expect(container.querySelector('header button[aria-label="Open menu"]')?.className)
      .toContain('text-white')
  })

  it('uses dark navigation when a public error page has no background', async () => {
    await act(async () => root.render(<Header />))

    expect(container.querySelector('header[data-public-site-header]')).not.toBeNull()
    expect(container.querySelector('header a[href="/events"][data-header-nav-item]'))
      .not.toBeNull()
    expect(container.querySelector('header a[href="/give"][data-header-give]'))
      .not.toBeNull()
    expect(container.querySelector('header button[aria-label="Open menu"][data-header-menu]'))
      .not.toBeNull()
  })

  it('keeps light navigation over the daily readings archive hero', async () => {
    navigation.pathname = '/daily-readings'
    await act(async () => root.render(<Header />))

    expect(container.querySelector('header a[href="/events"]')?.className)
      .toContain('text-white/90')
    expect(container.querySelector('header a[href="/give"]')?.className)
      .toContain('bg-white')
    expect(container.querySelector('header button[aria-label="Open menu"]')?.className)
      .toContain('text-white')
  })
})
