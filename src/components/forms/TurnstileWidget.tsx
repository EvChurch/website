'use client'

import { useEffect, useRef, useState } from 'react'

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
  const [status, setStatus] = useState<'checking' | 'verified' | 'failed'>('checking')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    let loadTimeout: ReturnType<typeof setTimeout> | undefined
    let verificationTimeout: ReturnType<typeof setTimeout> | undefined
    let failed = false
    let removeListeners: (() => void) | undefined
    const clearTimers = () => {
      if (loadTimeout) clearTimeout(loadTimeout)
      if (verificationTimeout) clearTimeout(verificationTimeout)
    }
    const fail = () => {
      if (cancelled || failed) return
      failed = true
      clearTimers()
      setStatus('failed')
      onToken('')
      onError?.('The security check could not load. Please try again.')
    }
    const checking = () => {
      clearTimers()
      failed = false
      setStatus('checking')
      verificationTimeout = setTimeout(fail, 30_000)
    }
    const render = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return
      checking()
      containerRef.current.innerHTML = ''
      try {
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          appearance: 'interaction-only',
          callback: (token) => {
            if (cancelled) return
            clearTimers()
            failed = false
            setStatus('verified')
            onToken(token)
          },
          'expired-callback': () => {
            if (cancelled) return
            checking()
            onToken('')
          },
          'error-callback': fail,
        })
      } catch {
        fail()
      }
    }

    setStatus('checking')
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
      const scriptFailed = () => {
        script.dataset.evTurnstileState = 'error'
        fail()
      }
      script.addEventListener('load', loaded, { once: true })
      script.addEventListener('error', scriptFailed, { once: true })
      removeListeners = () => {
        script.removeEventListener('load', loaded)
        script.removeEventListener('error', scriptFailed)
      }
      loadTimeout = setTimeout(scriptFailed, 15_000)
      if (!existing) {
        script.crossOrigin = 'anonymous'
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        script.async = true
        script.defer = true
        script.dataset.evTurnstile = 'true'
        document.head.appendChild(script)
      }
    }

    return () => {
      cancelled = true
      clearTimers()
      removeListeners?.()
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current)
        widgetId.current = undefined
      }
    }
  }, [siteKey, action, resetKey, onToken, onError, retry])

  return <div aria-label="Security check">
    <div ref={containerRef} />
    {status === 'checking' && <p role="status" className="text-sm text-dark-grey">Checking your browser… Complete the security check if prompted.</p>}
    {status === 'failed' && <div className="text-sm text-dark-grey"><p role="status">The security check needs another try. Payment stays disabled until it succeeds.</p><button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 font-semibold text-rich-red underline underline-offset-4">Retry security check</button></div>}
  </div>
}
