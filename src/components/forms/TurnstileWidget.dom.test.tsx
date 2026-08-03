// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TurnstileWidget } from './TurnstileWidget'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

describe('TurnstileWidget lifecycle', () => {
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
    delete window.turnstile
  })

  it('renders, forwards callbacks, replaces on reset, and removes on unmount', async () => {
    const onToken = vi.fn()
    const render = vi.fn((_element, options) => {
      options.callback('verified-token')
      options['expired-callback']()
      return `widget-${render.mock.calls.length}`
    })
    const remove = vi.fn()
    window.turnstile = { render, reset: vi.fn(), remove }

    await act(async () => root.render(
      <TurnstileWidget siteKey="site-key" action="start" resetKey={0} onToken={onToken} />,
    ))
    expect(onToken.mock.calls).toEqual([['verified-token'], ['']])
    expect(render).toHaveBeenCalledOnce()

    await act(async () => root.render(
      <TurnstileWidget siteKey="site-key" action="start" resetKey={1} onToken={onToken} />,
    ))
    expect(remove).toHaveBeenCalledWith('widget-1')
    expect(render).toHaveBeenCalledTimes(2)

    await act(async () => root.unmount())
    expect(remove).toHaveBeenLastCalledWith('widget-2')
  })
})
