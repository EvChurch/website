import Link from 'next/link'

import { EventCard } from '@/components/events/EventCard'
import { EventFeature } from '@/components/events/EventFeature'
import { getUpcomingEvents, selectFeaturedEvent } from '@/lib/events'

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
  const featured = selectFeaturedEvent(events)
  const remaining = featured ? events.filter((event) => event.id !== featured.id) : events

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <section className="px-5 pb-5 pt-24 lg:px-8 lg:pb-6 lg:pt-28">
        <div className="mx-auto max-w-[80rem]">
          <h1 className="sr-only">{heading}</h1>
          {featured && <EventFeature event={featured} />}
        </div>
      </section>

      <section className="px-5 pb-20 pt-5 lg:px-8 lg:pb-28 lg:pt-6">
        <div className="mx-auto max-w-[80rem]">
          <div className="max-w-3xl">
            <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-tight tracking-[-0.02em] text-white">Happening at our church</h2>
            <p className="mt-3 text-base leading-relaxed text-white/60">{introduction}</p>
          </div>

          <nav className="mt-7 flex flex-wrap gap-2" aria-label="Filter events by campus">
            {filters.map((filter) => {
              const active = filter.slug === (campusSlug ?? null)
              return (
                <Link
                  key={filter.href}
                  href={filter.href}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-10 items-center rounded-full border px-5 text-sm font-bold transition-colors focus:outline-none focus:ring-4 focus:ring-rich-red ${
                    active
                      ? 'border-white bg-white text-brand-black'
                      : 'border-white/25 bg-transparent text-white/75 hover:border-white hover:text-white'
                  }`}
                >
                  {filter.label}
                </Link>
              )
            })}
          </nav>

          {remaining.length > 0 ? (
            <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {remaining.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : featured ? (
            <p className="mt-10 border-t border-white/15 pt-8 text-white/60">
              That’s the next event for this campus. Check back soon for more.
            </p>
          ) : (
            <div className="mt-10 rounded-[1.25rem] border border-white/15 px-6 py-12">
              <h3 className="text-2xl text-white">No upcoming events just yet</h3>
              <p className="mt-3 max-w-xl text-white/60">
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
