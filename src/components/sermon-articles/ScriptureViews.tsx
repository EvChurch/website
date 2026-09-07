'use client'
import { useEffect } from 'react'
import Script from 'next/script'
import { apiBibleFumsTokens, reportApiBibleView } from '@/lib/api-bible-fums'
export function ScriptureViews({ token }: { token: string }) {
  useEffect(() => { apiBibleFumsTokens(token).forEach((value) => reportApiBibleView(window, value)) }, [token])
  return <Script src="https://pkg.api.bible/fumsV3.min.js" strategy="afterInteractive" />
}
