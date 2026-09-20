'use client'

import IframeResizer from '@iframe-resizer/react'
import type { RefObject } from 'react'

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

  return (
    <div className="animate-fade-in motion-reduce:animate-none">
      <IframeResizer
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
    </div>
  )
}
