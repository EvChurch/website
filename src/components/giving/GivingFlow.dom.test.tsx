// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PublicGivingFund } from '@/lib/giving/contracts'
import { GivingFlow } from './GivingFlow'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const funds: PublicGivingFund[] = [
  { id: 1, name: 'Missions', code: 'MISSIONS', sortOrder: 0, isDefault: false },
  { id: 2, name: 'General', code: 'GENERAL', sortOrder: 1, isDefault: true },
]

function button(container: HTMLElement, name: string) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((candidate) => candidate.textContent?.includes(name))
}
function change(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('GivingFlow', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    window.history.replaceState(null, '', '/')
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

  it('completes a monthly signed-in path with General and separate Name and Email review rows', async () => {
    await act(async () => root.render(<GivingFlow funds={funds} identity={{ signedIn: true, firstName: 'Alex', lastName: 'Taylor', email: 'alex@example.com' }} />))
    await act(async () => change(container.querySelector('input')!, '50'))
    await act(async () => button(container, 'Continue')?.click())
    expect(container.textContent).toContain('How often')
    await act(async () => button(container, 'Monthly')?.click())
    expect(container.textContent).toContain('When should it start')
    await act(async () => button(container, 'Tomorrow')?.click())
    expect(container.textContent).toContain('Review your gift')
    expect(container.textContent).toContain('General')
    expect(container.textContent).toContain('Name')
    expect(container.textContent).toContain('Email')

    await act(async () => button(container, 'Amount')?.click())
    await act(async () => change(container.querySelector('input')!, '75'))
    await act(async () => button(container, 'Continue')?.click())
    expect(container.textContent).toContain('Review your gift')
    expect(container.textContent).toContain('$75.00 NZD')
    expect(container.textContent).toContain('monthly')

    await act(async () => button(container, 'Name')?.click())
    expect(container.textContent).toContain('What is your first name')
    await act(async () => change(container.querySelector('input')!, 'Alexa'))
    await act(async () => button(container, 'Continue')?.click())
    expect(container.textContent).toContain('What is your last name')
    await act(async () => button(container, 'Continue')?.click())
    expect(container.textContent).toContain('Alexa Taylor')
    expect(container.textContent).toContain('alex@example.com')
  })

  it('keeps one-off plainly selectable without showing a starting-date step', async () => {
    await act(async () => root.render(<GivingFlow funds={funds} />))
    await act(async () => change(container.querySelector('input')!, '25'))
    await act(async () => button(container, 'Continue')?.click())
    expect(button(container, 'One-off gift')).toBeTruthy()
    await act(async () => button(container, 'One-off gift')?.click())
    expect(container.textContent).toContain('What is your first name')
    expect(container.textContent).not.toContain('When should it start')
  })

  it('allows successive amount digits and a decimal without rewriting the field mid-entry', async () => {
    await act(async () => root.render(<GivingFlow funds={funds} />))
    const input = container.querySelector<HTMLInputElement>('input')!
    for (const value of ['1', '12', '12.', '12.3', '12.34']) {
      await act(async () => change(input, value))
      expect(input.value).toBe(value)
    }
    await act(async () => button(container, 'Continue')?.click())
    expect(container.textContent).toContain('How often')
  })

  it('merges fresh signed-in Rock identity over a resumed blank guest draft', async () => {
    window.history.replaceState(null, '', '/events')
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ answers: {
      amountMinor: 5000, fundId: 2, frequency: 'monthly', startDate: '2026-09-01',
      firstName: '', lastName: '', email: '', returnPathname: '/events',
    } }), { status: 200, headers: { 'content-type': 'application/json' } }))
    await act(async () => root.render(<GivingFlow funds={funds} resumeRequested identity={{ signedIn: true, firstName: 'Fresh', lastName: 'Member', email: 'fresh@example.com' }} />))
    await act(async () => Promise.resolve())
    expect(container.textContent).toContain('Review your gift')
    expect(container.textContent).toContain('Fresh Member')
    expect(container.textContent).toContain('fresh@example.com')
  })

  it('asks only for email when that is the fresh signed-in identity field still missing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ answers: {
      amountMinor: 5000, fundId: 2, frequency: 'monthly', startDate: '2026-09-01',
      firstName: '', lastName: '', email: '', returnPathname: '/',
    } }), { status: 200, headers: { 'content-type': 'application/json' } }))
    await act(async () => root.render(<GivingFlow funds={funds} resumeRequested identity={{ signedIn: true, firstName: 'Fresh', lastName: 'Member' }} />))
    await act(async () => Promise.resolve())
    expect(container.textContent).toContain('What is your email')
    expect(container.textContent).not.toContain('What is your first name')
  })
})
