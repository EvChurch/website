import Link from 'next/link'

import { EventCard } from '@/components/events/EventCard'
import { EVENTS_BACKGROUND_CLASS } from '@/components/events/event-styles'
import { getUpcomingEvents } from '@/lib/events'
import type { UpcomingEventsBlock as PayloadUpcomingEventsBlock } from '@/payload-types'

const UPCOMING_EVENT_LIMIT = 3

type UpcomingEventsBlockProps = Pick<
  PayloadUpcomingEventsBlock,
  'eyebrow' | 'heading' | 'campusFilter'
>

function getCampusFilterSlug(campusFilter: PayloadUpcomingEventsBlock['campusFilter']) {
  if (!campusFilter || typeof campusFilter !== 'object') return undefined
  return campusFilter.slug ?? undefined
}

export async function UpcomingEventsBlockComponent({
  eyebrow = 'What’s on',
  heading = 'Upcoming events',
  campusFilter,
}: UpcomingEventsBlockProps) {
  const campusSlug = getCampusFilterSlug(campusFilter)
  const events = (await getUpcomingEvents(campusSlug)).slice(0, UPCOMING_EVENT_LIMIT)

  if (events.length === 0) return null

  const allEventsHref = campusSlug ? `/events/${campusSlug}` : '/events'

  return (
    <section className={`${EVENTS_BACKGROUND_CLASS} px-5 py-20 text-white lg:px-8 lg:py-28`}>
      <div className="mx-auto max-w-[80rem]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-widest text-rich-red">
                {eyebrow}
              </p>
            )}
            {heading && (
              <h2 className="mt-2 text-[clamp(1.75rem,3vw,2.5rem)] leading-tight tracking-[-0.02em] text-white">
                {heading}
              </h2>
            )}
          </div>
          <Link
            href={allEventsHref}
            className="inline-flex min-h-11 items-center self-start rounded-full border border-white/25 px-5 text-sm font-bold text-white/75 transition-colors hover:border-white hover:text-white focus:outline-none focus:ring-4 focus:ring-rich-red sm:self-auto"
          >
            View all events
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </div>
    </section>
  )
}
