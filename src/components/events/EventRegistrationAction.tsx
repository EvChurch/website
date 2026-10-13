'use client'

import type { MouseEvent } from 'react'

import { Button } from '@/components/ui/Button'
import { trackAnalyticsEvent } from '@/lib/analytics'

export const OPEN_EVENT_REGISTRATION = 'ev:open-event-registration'

export type OpenEventRegistrationDetail = {
  registrationInstanceId: number
  title: string
}

function getRegistrationInstanceId(href: string | null): number | null {
  if (!href) return null
  try {
    const url = new URL(href)
    if (url.protocol !== 'https:' || url.hostname !== 'registration.ev.church') {
      return null
    }
    const value = url.searchParams.get('RegistrationInstanceId')
    if (!value || !/^[1-9]\d*$/.test(value)) return null
    const id = Number(value)
    return Number.isSafeInteger(id) ? id : null
  } catch {
    return null
  }
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
  const registrationInstanceId = getRegistrationInstanceId(embeddedHref)

  const openRegistration = () => {
    if (!registrationInstanceId) return

    window.dispatchEvent(
      new CustomEvent<OpenEventRegistrationDetail>(OPEN_EVENT_REGISTRATION, {
        detail: { registrationInstanceId, title: eventTitle },
      }),
    )
  }

  return (
    <Button
      href={registrationHref}
      external
      className="mt-9 w-full"
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        trackAnalyticsEvent('event_registration_click', {
          event_slug: eventSlug,
          campus,
          destination_host: new URL(registrationHref).hostname,
        })
        if (
          !registrationInstanceId ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return
        }

        event.preventDefault()
        openRegistration()
      }}
    >
      Register now
    </Button>
  )
}
