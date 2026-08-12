import { useEffect, useRef } from 'react'
import Script from 'next/script'

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export function GoogleAnalytics({ pagePath }: { pagePath: string }) {
  const initialPagePath = useRef(pagePath)

  useEffect(() => {
    if (pagePath === initialPagePath.current) return
    window.gtag?.('event', 'page_view', {
      page_location: `${window.location.origin}${pagePath}`,
      page_path: pagePath,
    })
  }, [pagePath])

  if (!GA_ID) {
    return null
  }

  return (
    <>
      <Script
        crossOrigin="anonymous"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          window.gtag = function(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: false });
          gtag('event', 'page_view', {
            page_location: window.location.origin + '${pagePath}',
            page_path: '${pagePath}'
          });
        `}
      </Script>
    </>
  )
}
