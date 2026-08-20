'use client'

import { TrackedAnchor } from '@/components/analytics/TrackedLink'

export const OPEN_EVENT_REGISTRATION = 'ev:open-event-registration'

export type OpenEventRegistrationDetail = {
  href: string
  title: string
}

export function EventRegistrationAction({
  campus,
  embeddedHref,
  eventSlug,
  eventTitle,
  registrationHref,
}: {
  campus: string
  embeddedHref: string | null
  eventSlug: string
  eventTitle: string
  registrationHref: string
}) {
  return (
    <TrackedAnchor
      href={registrationHref}
      target="_blank"
      rel="noopener noreferrer"
      eventName="event_registration_click"
      eventParameters={{
        event_slug: eventSlug,
        campus,
        destination_host: new URL(registrationHref).hostname,
      }}
      onClick={(event) => {
        if (!embeddedHref || event.button !== 0 || event.metaKey || event.ctrlKey) return

        event.preventDefault()
        window.dispatchEvent(
          new CustomEvent<OpenEventRegistrationDetail>(OPEN_EVENT_REGISTRATION, {
            detail: { href: embeddedHref, title: eventTitle },
          }),
        )
      }}
      className="mt-9 inline-flex min-h-12 w-full items-center justify-center bg-rich-red px-6 text-center text-sm font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-deep-red focus:outline-none focus:ring-4 focus:ring-light-red-2"
    >
      Register now
    </TrackedAnchor>
  )
}
