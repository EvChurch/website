import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { PublicEvent } from '@/lib/events'

import { EventStatus } from './EventStatus'

const event: PublicEvent = {
  id: 1,
  title: 'Community Dinner',
  slug: 'community-dinner',
  summary: null,
  image: null,
  startDate: '2026-08-30T06:00:00.000Z',
  endDate: null,
  campus: null,
  location: null,
  contactPerson: null,
  registrationUrl: 'https://registration.ev.church/?RegistrationInstanceId=81',
  registrationStatus: 'open',
  featured: false,
  updatedAt: '2026-08-21T00:00:00.000Z',
}

describe('EventStatus', () => {
  it('does not repeat the open state beside the registration button', () => {
    expect(renderToStaticMarkup(<EventStatus event={event} />)).toBe('')
  })

  it('renders the closed state with readable text on the warm-white event page', () => {
    const markup = renderToStaticMarkup(
      <EventStatus event={{ ...event, registrationStatus: 'closed' }} />,
    )

    expect(markup).toContain('Registration closed')
    expect(markup).toContain('text-brand-black')
    expect(markup).not.toContain('text-white')
  })

  it('preserves the muted white treatment on dark featured cards', () => {
    const markup = renderToStaticMarkup(
      <EventStatus event={{ ...event, registrationStatus: 'closed' }} onDark />,
    )

    expect(markup).toContain('Registration closed')
    expect(markup).toContain('text-white/55')
    expect(markup).toContain('bg-white/40')
  })
})
