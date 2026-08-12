// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PublicError from './error'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

describe('frontend unexpected error boundary', () => {
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
  })

  it('orders Try again before Return home and does not disclose error data', async () => {
    const retry = vi.fn()
    await act(async () => root.render(
      <PublicError
        error={Object.assign(new Error('DATABASE_URL=password'), { digest: 'internal-123' })}
        retry={retry}
      />,
    ))
    const actions = [...container.querySelectorAll('button, a')]
    expect(actions.map((action) => action.textContent?.trim())).toEqual(['Try again', 'Return home'])
    expect(container.textContent).not.toContain('DATABASE_URL')
    expect(container.textContent).not.toContain('internal-123')
    await act(async () => (actions[0] as HTMLButtonElement).click())
    expect(retry).toHaveBeenCalledOnce()
    expect((actions[1] as HTMLAnchorElement).getAttribute('href')).toBe('/')
  })
})
