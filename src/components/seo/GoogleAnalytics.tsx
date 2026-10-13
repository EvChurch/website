import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { getAnalyticsPageContext } from '@/lib/analytics-attribution'

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID
let initialized = false

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export function GoogleAnalytics({ pagePath }: { pagePath: string }) {
  const lastPagePath = useRef<string | null>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (!GA_ID || lastPagePath.current === pagePath) return
    const context = getAnalyticsPageContext(window.location.href, document.referrer)
    if (!context || context.page_path !== pagePath) return

    window.dataLayer ??= []
    window.gtag ??= function () { window.dataLayer?.push(arguments) }
    // Child effects run before the manager's effect when returning from a private route.
    Object.assign(window, { [`ga-disable-${GA_ID}`]: false })
    // Set the sanitized context before configuration or any automatic events.
    window.gtag('set', context)
    if (!initialized) {
      window.gtag('js', new Date())
      window.gtag('config', GA_ID, { send_page_view: false })
      initialized = true
    }
    window.gtag('event', 'page_view', context)
    lastPagePath.current = pagePath
    setEnabled(true)
  }, [pagePath])

  if (!GA_ID || !enabled) {
    return null
  }

  return (
    <Script
      crossOrigin="anonymous"
      src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
      strategy="lazyOnload"
    />
  )
}
