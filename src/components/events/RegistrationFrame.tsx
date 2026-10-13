'use client'

import IframeResizer from '@iframe-resizer/react'
import { useEffect, useRef, useState, type RefObject } from 'react'

export function RegistrationFrame({
  src,
  title,
  scrollContainerRef,
}: {
  src: string
  title: string
  scrollContainerRef?: RefObject<HTMLDivElement | null>
}) {
  const origin = new URL(src).origin
  const frameRef = useRef<{ getElement: () => HTMLIFrameElement } | null>(null)
  const bridgeRef = useRef<HTMLIFrameElement>(null)
  const [channel, setChannel] = useState<string | null>(null)

  useEffect(() => setChannel(null), [src])
  useEffect(() => {
    function receive(event: MessageEvent<unknown>) {
      if (event.origin !== origin || !event.data || typeof event.data !== 'object') return
      const data = event.data as { type?: unknown; channel?: unknown }
      if (typeof data.channel !== 'string' || !/^[a-f0-9]{64}$/.test(data.channel)) return
      if (data.type === 'blinkpay:connect' && event.source === frameRef.current?.getElement()?.contentWindow) {
        setChannel(data.channel)
      } else if (data.type === 'blinkpay:attention' && data.channel === channel &&
        event.source === bridgeRef.current?.contentWindow) {
        // This is only a request for attention, never proof of payment.
        scrollContainerRef?.current?.scrollTo({ top: 0, behavior: 'instant' })
        window.focus()
        bridgeRef.current?.contentWindow?.postMessage({ type: 'blinkpay:launcher-ready', channel }, origin)
      }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [channel, origin, scrollContainerRef])

  // A separate frame keeps the channel alive when the visible Rock frame navigates.
  const bridgeUrl = channel && typeof window !== 'undefined'
    ? `${origin}/Plugins/ChurchEv/BlinkPay/Bridge.ashx?${new URLSearchParams({ channel, parent: window.location.origin })}`
    : null

  return (
    <div className="animate-fade-in motion-reduce:animate-none">
      <IframeResizer
        forwardRef={frameRef}
        id="event-registration-frame"
        src={src}
        title={title}
        license="GPLv3"
        checkOrigin={[origin]}
        direction="vertical"
        onLoad={() => scrollContainerRef?.current?.scrollTo({ top: 0, behavior: 'instant' })}
        allow="payment"
        referrerPolicy="strict-origin-when-cross-origin"
        className="block w-full border-0 bg-transparent"
      />
      {bridgeUrl && (
        <iframe ref={bridgeRef} src={bridgeUrl} title="Payment window connection"
          hidden aria-hidden="true" tabIndex={-1} referrerPolicy="no-referrer" />
      )}
    </div>
  )
}
