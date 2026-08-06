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
      '/member-auth/login?returnTo=%2Fsermons%3Fcampus%3D2',
    )
    expect(link?.className).toContain('min-h-10')
    expect(container.textContent).not.toContain('Aroha')
  })

  it('opens only the minimal profile details and uses unique relationships', async () => {
    await act(async () => root.render(
      <>
        <MemberAccountControl profile={member} variant="desktop" tone="dark" />
        <MemberAccountControl profile={member} variant="mobile-icon" tone="dark" />
      </>,
    ))

    const triggers = [...container.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]')]
    expect(triggers).toHaveLength(2)
    expect(triggers[0]?.getAttribute('aria-controls')).not.toBe(
      triggers[1]?.getAttribute('aria-controls'),
    )

    await act(async () => triggers[0]?.click())
    expect(triggers[0]?.getAttribute('aria-expanded')).toBe('true')
    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('Aroha Ngata')
    expect(dialog?.textContent).toContain('aroha@example.com')
    expect(dialog?.querySelector<HTMLAnchorElement>('a')?.getAttribute('href')).toBe(
      '/member-auth/logout?returnTo=%2Fsermons%3Fcampus%3D2',
    )
    expect(dialog?.textContent).not.toContain('personId')
    expect(dialog?.textContent).not.toContain('Auth0')
  })

  it('closes on Escape and outside press, restoring trigger focus', async () => {
    await act(async () => root.render(
      <MemberAccountControl profile={member} variant="desktop" tone="dark" />,
    ))
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!

    await act(async () => trigger.click())
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)

    await act(async () => trigger.click())
    await act(async () => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('closes a popover when its containing surface becomes inactive', async () => {
    await act(async () => root.render(
      <MemberAccountControl profile={member} variant="drawer" active />,
    ))
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!
    await act(async () => trigger.click())
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()

    await act(async () => root.render(
      <MemberAccountControl profile={member} variant="drawer" active={false} />,
    ))
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('closes an open popover when the route changes', async () => {
    await act(async () => root.render(
      <MemberAccountControl profile={member} variant="desktop" tone="dark" />,
    ))
    const trigger = container.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!
    await act(async () => trigger.click())

    navigation.pathname = '/events'
    await act(async () => root.render(
      <MemberAccountControl profile={member} variant="desktop" tone="dark" />,
    ))

    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('falls back to initials when the member image fails', async () => {
    await act(async () => root.render(
      <MemberAccountControl profile={member} variant="desktop" tone="dark" />,
    ))
    const image = container.querySelector<HTMLImageElement>('img')!
    await act(async () => image.dispatchEvent(new Event('error')))
    expect(container.textContent).toContain('AN')
  })

  it('places account access after Give and in both mobile surfaces', async () => {
    await act(async () => root.render(<Header memberProfile={member} />))

    const give = container.querySelector<HTMLAnchorElement>('a[href="/give"]')!
    expect(give.nextElementSibling?.querySelector('button[aria-haspopup="dialog"]')).not.toBeNull()

    const accountTriggers = container.querySelectorAll(
      'button[aria-label="Open account for Aroha Ngata"]',
    )
    expect(accountTriggers).toHaveLength(3)

    const hamburger = container.querySelector<HTMLButtonElement>('button[aria-label="Open menu"]')!
    expect(hamburger.previousElementSibling?.querySelector('button[aria-haspopup="dialog"]')).not.toBeNull()

    const drawerAccount = accountTriggers[2]!
    const planVisit = container.querySelector<HTMLAnchorElement>('a[href="/visit"].bg-rich-red')!
    expect(
      drawerAccount.compareDocumentPosition(planVisit) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0)
  })
})
