import Link from 'next/link'
import { HiOutlineCalendarDays, HiOutlineClock, HiOutlineMapPin } from 'react-icons/hi2'

import { EventImage } from '@/components/events/EventImage'
import { formatEventDay, formatEventTime, getDisplayLocation, type PublicEvent } from '@/lib/events'

export function EventCard({ event }: { event: PublicEvent }) {
  const location = getDisplayLocation(event)

  return (
    <article className="group">
      <Link href={`/events/${event.slug}`} className="block focus:outline-none">
        <div className="relative aspect-video overflow-hidden rounded-[1.25rem] bg-[#202020] ring-rich-red transition-shadow duration-300 group-focus-within:ring-4">
          <EventImage
            event={event}
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
            className="transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        </div>
        <div className="px-1 pt-5">
          <h2 className="text-[clamp(1.35rem,2vw,1.75rem)] leading-tight text-white transition-colors group-hover:text-light-red-1">
            {event.title}
          </h2>
          <div className="mt-4 space-y-2 text-sm text-white/65">
            <p className="flex items-center gap-2.5"><HiOutlineCalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />{formatEventDay(event)}</p>
            <p className="flex items-center gap-2.5"><HiOutlineClock className="h-4 w-4 shrink-0" aria-hidden="true" />{formatEventTime(event)}</p>
            {location && (
              <p className="flex items-center gap-2.5"><HiOutlineMapPin className="h-4 w-4 shrink-0" aria-hidden="true" />{location}</p>
            )}
          </div>
        </div>
      </Link>
    </article>
  )
}
