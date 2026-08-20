'use client'

import IframeResizer from '@iframe-resizer/react'

export function RegistrationFrame({ src, title }: { src: string; title: string }) {
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
        allow="payment"
        referrerPolicy="strict-origin-when-cross-origin"
        className="block w-full border-0 bg-transparent"
      />
    </div>
  )
}
