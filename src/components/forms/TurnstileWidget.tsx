'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string
          action: string
          appearance: 'interaction-only'
          callback: (token: string) => void
          'expired-callback': () => void
          'error-callback': () => void
        },
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId: string) => void
    }
  }
}

export function TurnstileWidget({
  siteKey,
  action,
  resetKey,
  onToken,
  onError,
}: {
  siteKey: string
  action: string
  resetKey: number
  onToken: (token: string) => void
  onError?: (message: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    let loadTimeout: ReturnType<typeof setTimeout> | undefined
    let loadSettled = false
    const fail = () => {
      if (cancelled || loadSettled) return
      loadSettled = true
      if (loadTimeout) clearTimeout(loadTimeout)
      onToken('')
      onError?.('The security check could not load. Please try again.')
    }
    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return
      loadSettled = true
      if (loadTimeout) clearTimeout(loadTimeout)
      containerRef.current.innerHTML = ''
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        appearance: 'interaction-only',
        callback: onToken,
        'expired-callback': () => onToken(''),
        'error-callback': fail,
      })
    }

    if (window.turnstile) {
      render()
    } else {
      const failedScript = document.querySelector<HTMLScriptElement>(
        'script[data-ev-turnstile][data-ev-turnstile-state="error"]',
      )
      failedScript?.remove()
      const existing = document.querySelector<HTMLScriptElement>('script[data-ev-turnstile]')
      const script = existing || document.createElement('script')
      const loaded = () => {
        script.dataset.evTurnstileState = 'loaded'
        render()
      }
      const failed = () => {
        script.dataset.evTurnstileState = 'error'
        fail()
      }
      script.addEventListener('load', loaded, { once: true })
      script.addEventListener('error', failed, { once: true })
      loadTimeout = setTimeout(failed, 15_000)
      if (!existing) {
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        script.async = true
        script.defer = true
        script.dataset.evTurnstile = 'true'
        document.head.appendChild(script)
      }
    }

    return () => {
      cancelled = true
      if (loadTimeout) clearTimeout(loadTimeout)
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current)
        widgetId.current = undefined
      }
    }
  }, [siteKey, action, resetKey, onToken, onError])

  return <div ref={containerRef} aria-label="Security check" />
}
