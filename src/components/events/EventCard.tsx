import Link from 'next/link'

import { EventImage } from '@/components/events/EventImage'
import { EventStatus } from '@/components/events/EventStatus'
import { formatEventDate, getCampusName, type PublicEvent } from '@/lib/events'

export function EventCard({ event }: { event: PublicEvent }) {
  const campus = getCampusName(event)
  const location = event.location?.name

  return (
    <article className="group">
      <Link href={`/events/${event.slug}`} className="block focus:outline-none">
        <div className="relative aspect-[4/3] overflow-hidden bg-brand-black ring-rich-red transition-shadow duration-300 group-focus-within:ring-4">
          <EventImage
            event={event}
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
            className="transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-black/35 via-transparent to-transparent" />
        </div>
        <div className="pt-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-rich-red">
            {formatEventDate(event)}
          </p>
          <h2 className="mt-2 text-[clamp(1.45rem,2.2vw,2rem)] leading-tight text-brand-black transition-colors group-hover:text-rich-red">
            {event.title}
          </h2>
          {(campus || location) && (
            <p className="mt-2 text-sm text-mid-grey">{[campus, location].filter(Boolean).join(' · ')}</p>
          )}
          <div className="mt-3">
            <EventStatus event={event} compact />
          </div>
        </div>
      </Link>
    </article>
  )
}
