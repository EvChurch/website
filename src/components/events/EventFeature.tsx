import Link from 'next/link'

import { EventImage } from '@/components/events/EventImage'
import { EventStatus } from '@/components/events/EventStatus'
import { formatEventDate, getCampusName, toPlainText, type PublicEvent } from '@/lib/events'

export function EventFeature({ event }: { event: PublicEvent }) {
  const summary = toPlainText(event.summary)

  return (
    <section className="relative min-h-[20rem] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#171717] text-white sm:min-h-[22rem]">
      <EventImage event={event} priority sizes="(min-width: 1280px) 1216px, calc(100vw - 2.5rem)" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/5" />
      <div className="relative flex min-h-[20rem] items-end p-5 sm:min-h-[22rem] sm:p-8 lg:p-10">
        <div className="grid w-full items-end gap-7 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/65">Featured event</p>
            <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.6rem)] leading-tight tracking-[-0.025em] text-white">
              {event.title}
            </h2>
            <p className="mt-4 text-sm font-semibold text-white/80">
              {formatEventDate(event)}
              {getCampusName(event) ? ` · ${getCampusName(event)}` : ''}
            </p>
            {summary && <p className="mt-3 max-w-xl text-base leading-relaxed text-white/75">{summary}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <Link
              href={`/events/${event.slug}`}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-bold text-brand-black transition-colors hover:bg-warm-white focus:outline-none focus:ring-4 focus:ring-rich-red"
            >
              View event
            </Link>
            <EventStatus event={event} />
          </div>
        </div>
      </div>
    </section>
  )
}
