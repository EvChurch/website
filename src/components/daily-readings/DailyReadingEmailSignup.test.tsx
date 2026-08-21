// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DailyReadingEmailSignup } from './DailyReadingEmailSignup'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

describe('DailyReadingEmailSignup', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('hides the signup CTA for an existing subscriber', async () => {
    await act(async () => root.render(<DailyReadingEmailSignup initiallySubscribed />))
    expect(container.textContent).toBe('')
  })

  it('signs the authenticated member up with one click', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ subscribed: true }),
      { status: 200 },
    ))
    vi.stubGlobal('fetch', fetch)
    await act(async () => root.render(
      <DailyReadingEmailSignup initiallySubscribed={false} />,
    ))
    await act(async () => container.querySelector<HTMLButtonElement>('button')?.click())

    expect(fetch).toHaveBeenCalledWith('/api/member-daily-reading-email', { method: 'POST' })
    expect(container.querySelector('[role="status"]')?.textContent).toContain('You’re signed up.')
    expect(container.querySelector('button')).toBeNull()
  })

  it('keeps a retry available when signup fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 502 })))
    await act(async () => root.render(
      <DailyReadingEmailSignup initiallySubscribed={false} />,
    ))
    await act(async () => container.querySelector<HTMLButtonElement>('button')?.click())

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Please try again.')
    expect(container.querySelector('button')?.textContent).toContain('Sign up for emails')
  })
})
