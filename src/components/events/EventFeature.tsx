import Link from 'next/link'

import { EventImage } from '@/components/events/EventImage'
import { EventStatus } from '@/components/events/EventStatus'
import { formatEventDate, getCampusName, toPlainText, type PublicEvent } from '@/lib/events'

export function EventFeature({ event }: { event: PublicEvent }) {
  const summary = toPlainText(event.summary)

  return (
    <section className="bg-brand-black text-white">
      <div className="mx-auto grid max-w-[80rem] lg:min-h-[34rem] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative min-h-[22rem] overflow-hidden lg:order-2 lg:min-h-full">
          <EventImage event={event} priority sizes="(min-width: 1024px) 50vw, 100vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-black/50 via-transparent to-transparent lg:bg-gradient-to-r lg:from-brand-black/45 lg:to-transparent" />
        </div>
        <div className="flex items-center px-5 py-14 sm:px-8 lg:order-1 lg:px-12 lg:py-20">
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-light-red-2">Featured event</p>
            <h1 className="mt-5 text-[clamp(3rem,7vw,6rem)] leading-[0.92] tracking-[-0.04em] text-white">
              {event.title}
            </h1>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.12em] text-white/75">
              {formatEventDate(event)}
              {getCampusName(event) ? ` · ${getCampusName(event)}` : ''}
            </p>
            {summary && <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/75">{summary}</p>}
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link
                href={`/events/${event.slug}`}
                className="inline-flex min-h-12 items-center justify-center bg-rich-red px-7 text-sm font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-deep-red focus:outline-none focus:ring-4 focus:ring-light-red-2"
              >
                Event details
              </Link>
              <EventStatus event={event} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
