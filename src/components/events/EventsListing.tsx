import Link from 'next/link'

import { EventCard } from '@/components/events/EventCard'
import { EventFeature } from '@/components/events/EventFeature'
import { getUpcomingEvents } from '@/lib/events'

const filters = [
  { label: 'All events', href: '/events', slug: null },
  { label: 'North', href: '/events/north', slug: 'north' },
  { label: 'Central', href: '/events/central', slug: 'central' },
  { label: 'Unichurch', href: '/events/unichurch', slug: 'unichurch' },
] as const

interface EventsListingProps {
  campusSlug?: 'north' | 'central' | 'unichurch'
  heading?: string
  introduction?: string
}

export async function EventsListing({
  campusSlug,
  heading = 'What’s happening at Ev',
  introduction = 'Find gatherings, courses, and opportunities to connect across our Auckland church community.',
}: EventsListingProps) {
  const events = await getUpcomingEvents(campusSlug)
  const featured = events[0]
  const remaining = events.slice(1)

  return (
    <div className="bg-warm-white">
      {featured ? (
        <EventFeature event={featured} />
      ) : (
        <section className="bg-brand-black px-5 pb-20 pt-40 text-white lg:px-8 lg:pb-24">
          <div className="mx-auto max-w-[80rem]">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-light-red-2">Events</p>
            <h1 className="mt-4 max-w-4xl text-[clamp(3.5rem,9vw,7.5rem)] leading-[0.9] tracking-[-0.045em] text-white">
              {heading}
            </h1>
          </div>
        </section>
      )}

      <section className="px-5 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-[80rem]">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-rich-red">Upcoming events</p>
            <h2 className="mt-3 text-[clamp(2.4rem,5vw,4.5rem)] leading-[0.95] tracking-[-0.035em] text-brand-black">
              {heading}
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-dark-grey">{introduction}</p>
          </div>

          <nav className="mt-10 flex flex-wrap gap-2" aria-label="Filter events by campus">
            {filters.map((filter) => {
              const active = filter.slug === (campusSlug ?? null)
              return (
                <Link
                  key={filter.href}
                  href={filter.href}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-11 items-center border px-5 text-sm font-bold transition-colors focus:outline-none focus:ring-4 focus:ring-light-red-2 ${
                    active
                      ? 'border-brand-black bg-brand-black text-white'
                      : 'border-warm-grey bg-transparent text-brand-black hover:border-rich-red hover:text-rich-red'
                  }`}
                >
                  {filter.label}
                </Link>
              )
            })}
          </nav>

          {remaining.length > 0 ? (
            <div className="mt-14 grid grid-cols-1 gap-x-7 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {remaining.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : featured ? (
            <p className="mt-14 border-t border-warm-grey pt-8 text-dark-grey">
              That’s the next event for this campus. Check back soon for more.
            </p>
          ) : (
            <div className="mt-14 border-y border-warm-grey py-12">
              <h2 className="text-2xl text-brand-black">No upcoming events just yet</h2>
              <p className="mt-3 max-w-xl text-dark-grey">
                New events are added regularly. You can browse every campus or check back soon.
              </p>
              {campusSlug && (
                <Link href="/events" className="mt-6 inline-flex font-bold text-rich-red hover:text-deep-red">
                  View all events
                </Link>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
