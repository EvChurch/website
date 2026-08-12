// @vitest-environment happy-dom

import { act } from 'react'
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
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllEnvs()
  })

  it('loads the external script with anonymous CORS', async () => {
    const { GoogleAnalytics } = await import('./GoogleAnalytics')

    await act(async () => root.render(<GoogleAnalytics pagePath="/sermons" />))

    const script = container.querySelector<HTMLScriptElement>(
      'script[src="https://www.googletagmanager.com/gtag/js?id=G-TEST"]',
    )
    expect(script?.crossOrigin).toBe('anonymous')
  })
})
