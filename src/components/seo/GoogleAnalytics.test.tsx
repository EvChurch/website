// @vitest-environment happy-dom

import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

vi.mock('next/script', () => ({
  default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <script {...props}>{children}</script>
  ),
}))

describe('GoogleAnalytics', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST')
    vi.stubGlobal('location', new URL('https://www.ev.church/sermons'))
    delete window.gtag
    delete window.dataLayer
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('loads the external script with anonymous CORS', async () => {
    const { GoogleAnalytics } = await import('./GoogleAnalytics')

    await act(async () => root.render(<GoogleAnalytics pagePath="/sermons" />))

    const script = container.querySelector<HTMLScriptElement>(
      'script[src="https://www.googletagmanager.com/gtag/js?id=G-TEST"]',
    )
    expect(script?.crossOrigin).toBe('anonymous')
    expect(script?.getAttribute('strategy')).toBe('lazyOnload')
    expect(window.dataLayer?.map((command) => Array.from(command as IArguments))).toEqual([
      ['set', expect.objectContaining({ page_location: 'https://www.ev.church/sermons' })],
      ['js', expect.any(Date)],
      ['config', 'G-TEST', { send_page_view: false }],
      ['event', 'page_view', expect.objectContaining({ page_path: '/sermons' })],
    ])
  })

  it('retains attribution on arrival and records navigation back to the initial page', async () => {
    vi.stubGlobal('location', new URL('https://www.ev.church/visit?utm_source=google&utm_medium=cpc&gclid=test-click&token=private#secret'))
    const gtag = vi.fn()
    window.gtag = gtag
    const { GoogleAnalytics } = await import('./GoogleAnalytics')
    await act(async () => root.render(<GoogleAnalytics pagePath="/visit" />))

    expect(gtag).toHaveBeenCalledWith('event', 'page_view', {
      page_location: 'https://www.ev.church/visit?utm_source=google&utm_medium=cpc&gclid=test-click',
      page_path: '/visit', page_referrer: '',
    })
    for (const path of ['/campus/north', '/visit']) {
      vi.stubGlobal('location', new URL(`https://www.ev.church${path}`))
      await act(async () => root.render(<GoogleAnalytics pagePath={path} />))
    }
    expect(gtag.mock.calls.filter(([command, name]) => command === 'event' && name === 'page_view')).toHaveLength(3)
    expect(gtag.mock.calls.filter(([command]) => command === 'config')).toHaveLength(1)
  })

  it.each(['http://localhost:3000/visit', 'https://preview.ev.church/visit', 'https://www.ev.church/contact'])('does not initialize or load the production tag on %s', async (href) => {
    vi.stubGlobal('location', new URL(href))
    const { GoogleAnalytics } = await import('./GoogleAnalytics')
    await act(async () => root.render(<GoogleAnalytics pagePath={new URL(href).pathname} />))
    expect(container.querySelector('script')).toBeNull()
    expect(window.gtag).toBeUndefined()
    expect(window.dataLayer).toBeUndefined()
  })

  it('re-enables capture before the first event on return from a private route', async () => {
    Object.assign(window, { 'ga-disable-G-TEST': true })
    const disabledAtPageView: unknown[] = []
    window.gtag = (command, name) => {
      if (command === 'event' && name === 'page_view') {
        disabledAtPageView.push(Reflect.get(window, 'ga-disable-G-TEST'))
      }
    }
    const { GoogleAnalytics } = await import('./GoogleAnalytics')
    await act(async () => root.render(<GoogleAnalytics pagePath="/sermons" />))
    expect(disabledAtPageView).toEqual([false])
    Reflect.deleteProperty(window, 'ga-disable-G-TEST')
  })

  it('does not duplicate the page view when React replays effects', async () => {
    const gtag = vi.fn()
    window.gtag = gtag
    const { GoogleAnalytics } = await import('./GoogleAnalytics')
    await act(async () => root.render(<StrictMode><GoogleAnalytics pagePath="/sermons" /></StrictMode>))
    expect(gtag.mock.calls.filter(([command]) => command === 'config')).toHaveLength(1)
    expect(gtag.mock.calls.filter(([command, name]) => command === 'event' && name === 'page_view')).toHaveLength(1)
  })
})
