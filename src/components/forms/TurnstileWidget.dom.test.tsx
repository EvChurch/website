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
    document.querySelectorAll('script[data-ev-turnstile]').forEach((script) => script.remove())
    vi.useRealTimers()
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
    expect(render).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ appearance: 'interaction-only' }),
    )
    expect(container.firstElementChild?.className).not.toContain('min-h-')

    await act(async () => root.render(
      <TurnstileWidget siteKey="site-key" action="start" resetKey={1} onToken={onToken} />,
    ))
    expect(remove).toHaveBeenCalledWith('widget-1')
    expect(render).toHaveBeenCalledTimes(2)

    await act(async () => root.unmount())
    expect(remove).toHaveBeenLastCalledWith('widget-2')
  })

  it('reports script load failures and permits a fresh script attempt', async () => {
    const onError = vi.fn()
    await act(async () => root.render(
      <TurnstileWidget
        siteKey="site-key"
        action="start"
        resetKey={0}
        onToken={() => undefined}
        onError={onError}
      />,
    ))

    const failedScript = document.querySelector<HTMLScriptElement>(
      'script[data-ev-turnstile]',
    )
    expect(failedScript?.crossOrigin).toBe('anonymous')
    await act(async () => { failedScript?.dispatchEvent(new Event('error')) })
    expect(onError).toHaveBeenCalledWith(
      'The security check could not load. Please try again.',
    )
    expect(failedScript?.dataset.evTurnstileState).toBe('error')

    await act(async () => root.render(
      <TurnstileWidget
        siteKey="site-key"
        action="start"
        resetKey={1}
        onToken={() => undefined}
        onError={onError}
      />,
    ))
    expect(document.querySelector('script[data-ev-turnstile]')).not.toBe(
      failedScript,
    )
  })

  it('reports provider errors after rendering and retries without accepting a token', async () => {
    const onToken = vi.fn()
    const onError = vi.fn()
    const render = vi.fn<NonNullable<Window['turnstile']>['render']>().mockReturnValue('widget-1')
    const remove = vi.fn()
    window.turnstile = { render, reset: vi.fn(), remove }
    await act(async () => root.render(<TurnstileWidget siteKey="site-key" action="giving-checkout" resetKey={0} onToken={onToken} onError={onError} />))
    expect(container.textContent).toContain('Checking your browser')
    await act(async () => render.mock.calls[0][1]['error-callback']())
    expect(onError).toHaveBeenCalledOnce()
    expect(onToken).toHaveBeenLastCalledWith('')
    expect(container.querySelector('button')?.textContent).toBe('Retry security check')
    await act(async () => container.querySelector('button')!.click())
    expect(remove).toHaveBeenCalledWith('widget-1')
    expect(render).toHaveBeenCalledTimes(2)
    expect(onToken).not.toHaveBeenCalledWith('verified-token')
    await act(async () => render.mock.calls[1][1].callback('verified-token'))
    expect(onToken).toHaveBeenLastCalledWith('verified-token')
    expect(container.querySelector('button')).toBeNull()
    expect(container.textContent).not.toContain('Checking your browser')
  })

  it('offers retry if a rendered challenge never completes, then handles token expiry', async () => {
    vi.useFakeTimers()
    const onToken = vi.fn()
    const onError = vi.fn()
    const render = vi.fn<NonNullable<Window['turnstile']>['render']>().mockReturnValue('widget-1')
    window.turnstile = { render, reset: vi.fn(), remove: vi.fn() }
    await act(async () => root.render(<TurnstileWidget siteKey="site-key" action="giving-checkout" resetKey={0} onToken={onToken} onError={onError} />))
    await act(async () => vi.advanceTimersByTime(30_000))
    expect(onError).toHaveBeenCalledOnce()
    expect(onToken).toHaveBeenLastCalledWith('')
    await act(async () => container.querySelector('button')!.click())
    await act(async () => render.mock.calls[1][1].callback('verified-token'))
    await act(async () => render.mock.calls[1][1]['expired-callback']())
    expect(onToken).toHaveBeenLastCalledWith('')
    expect(container.textContent).toContain('Checking your browser')
    await act(async () => vi.advanceTimersByTime(30_000))
    expect(container.querySelector('button')?.textContent).toBe('Retry security check')
  })
})
