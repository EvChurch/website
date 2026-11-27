// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemberPortalChrome } from './MemberPortalChrome'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let container: HTMLDivElement, root: Root
beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ enabled: true }) }))
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<MemberPortalChrome active="giving" member={{ name: 'Aroha Ngata', email: 'aroha@example.test', avatarUrl: null }} canAccessLeaderResources={false} connectGroupHref="/members/connect-groups"><p>Giving</p></MemberPortalChrome>))
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

it('opens the compact menu and restores toggle focus on Escape', async () => {
  const toggle = container.querySelector('nav button')!
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(toggle.textContent).toContain('Giving')
  await act(async () => (toggle as HTMLButtonElement).click())
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  const links = [...container.querySelectorAll<HTMLAnchorElement>('nav a')]
  expect(links.map(link => link.textContent)).toEqual(['Overview', 'Daily Reading', 'Connect Group', 'Study Resources', 'My Service', 'Giving', 'Courses', 'Reimbursements', 'Help'])
  expect(links.find(link => link.getAttribute('aria-current') === 'page')?.textContent).toBe('Giving')
  links[0].focus()
  await act(async () => links[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(document.activeElement).toBe(toggle)
})

it('closes the compact menu when a destination is selected', async () => {
  const toggle = container.querySelector<HTMLButtonElement>('nav button')!
  await act(async () => toggle.click())
  const courses = container.querySelector<HTMLAnchorElement>('nav a[href="/members/courses"]')!
  courses.addEventListener('click', event => event.preventDefault())
  await act(async () => courses.click())
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  expect(fetch).toHaveBeenCalledTimes(1)
})
