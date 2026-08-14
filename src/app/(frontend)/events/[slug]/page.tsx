import type { Metadata } from 'next'
import Link from 'next/link'

import RichText from '@/components/blocks/RichTextRenderer'
import { EventImage } from '@/components/events/EventImage'
import { EventSharing } from '@/components/events/EventSharing'
import { EventStatus } from '@/components/events/EventStatus'
import { TrackedAnchor } from '@/components/analytics/TrackedLink'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { EventJsonLd } from '@/components/seo/EventJsonLd'
import { getPayloadMediaUrl } from '@/lib/payload-media'
import { DEFAULT_OPEN_GRAPH_IMAGES } from '@/lib/seo-metadata'
import { trackedNotFound } from '@/lib/tracked-not-found'
import {
  formatEventDate,
  getCampusName,
  getEventBySlug,
  getEventImage,
  getRegistrationHref,
  isPastEvent,
  toPlainText,
} from '@/lib/events'

type Props = { params: Promise<{ slug: string }> }

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) return { title: 'Event not found | Ev Church' }

  const description =
    toPlainText(event.summary).slice(0, 155) ||
    `${event.title} at Ev Church in Auckland. Find event dates, location details, and registration information.`
  const image = getEventImage(event)
  const imageUrl = image ? getPayloadMediaUrl(image, 'large') : null
  const url = `https://www.ev.church/events/${event.slug}`

  return {
    title: `${event.title} | Ev Church Auckland`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${event.title} | Ev Church Auckland`,
      description,
      url,
      siteName: 'Ev Church',
      locale: 'en_NZ',
      type: 'website',
      images: imageUrl
        ? [{ url: imageUrl, alt: image?.alt || event.title }]
        : DEFAULT_OPEN_GRAPH_IMAGES,
    },
  }
}

export default async function EventDetailPage({ params }: Props) {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) trackedNotFound('events', slug)

  const past = isPastEvent(event)
  const campus = getCampusName(event)
  const registrationHref = !past ? getRegistrationHref(event) : null

  return (
    <div className="bg-warm-white">
      <EventJsonLd event={event} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://www.ev.church' },
          { name: 'Events', url: 'https://www.ev.church/events' },
          { name: event.title, url: `https://www.ev.church/events/${event.slug}` },
        ]}
      />

      <section className="overflow-hidden bg-[linear-gradient(90deg,#0b0003,#18070b_50%,#0b0003)] text-white">
        <div className="mx-auto flex max-w-[80rem] flex-col pb-12 pt-20 sm:pb-16 lg:grid lg:min-h-[37.5rem] lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:gap-14 lg:px-8 lg:py-[4.5rem]">
          <div className="min-w-0 px-5 pt-10 sm:px-8 sm:pt-12 lg:px-0 lg:pt-0">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-light-red-2">
              {past ? 'Past event' : 'Upcoming event'}
            </p>
            <h1 className="mt-[1.125rem] text-[clamp(3.375rem,15vw,4.5rem)] leading-[0.86] tracking-[-0.055em] text-white sm:text-[clamp(4rem,9vw,5.25rem)] lg:text-[clamp(4rem,6.2vw,5.25rem)]">
              {event.title}
            </h1>
            <p className="mt-6 max-w-96 text-sm font-semibold uppercase leading-normal tracking-[0.12em] text-white/80">
              {formatEventDate(event)}
              {campus ? ` · ${campus}` : ''}
            </p>
          </div>

          <div className="relative order-first aspect-video w-full overflow-hidden shadow-[0_28px_70px_rgba(0,0,0,0.53)] lg:order-none">
            <EventImage
              event={event}
              priority
              sizes="(max-width: 1023px) 100vw, (max-width: 1280px) 60vw, 720px"
            />
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="mx-auto grid max-w-[80rem] gap-14 px-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-20 lg:px-8">
          <article>
            {past && (
              <div className="mb-10 border-l-4 border-rich-red bg-white px-6 py-5">
                <h2 className="text-xl text-brand-black">This event has ended</h2>
                <p className="mt-2 text-dark-grey">Explore upcoming events to see what’s happening next.</p>
              </div>
            )}
            {event.summary ? (
              <div className="prose-events text-lg leading-relaxed text-dark-grey">
                <RichText data={event.summary} />
              </div>
            ) : (
              <p className="text-lg leading-relaxed text-dark-grey">
                We’d love to have you with us. The key date, location, and registration details are listed here.
              </p>
            )}
          </article>

          <aside className="border-t border-warm-grey pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <dl className="space-y-7">
              <div>
                <dt className="text-xs font-bold uppercase tracking-[0.16em] text-rich-red">When</dt>
                <dd className="mt-2 text-base leading-relaxed text-brand-black">{formatEventDate(event)}</dd>
              </div>
              {(campus || event.location?.name || event.location?.address) && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-[0.16em] text-rich-red">Where</dt>
                  <dd className="mt-2 text-base leading-relaxed text-brand-black">
                    {campus && <span className="block font-semibold">{campus}</span>}
                    {event.location?.name && <span className="block">{event.location.name}</span>}
                    {event.location?.address && <span className="block text-mid-grey">{event.location.address}</span>}
                  </dd>
                </div>
              )}
              {!past && event.registrationStatus && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-[0.16em] text-rich-red">Registration</dt>
                  <dd className="mt-3"><EventStatus event={event} /></dd>
                </div>
              )}
              {(event.contactPerson?.name || event.contactPerson?.email || event.contactPerson?.phone) && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-[0.16em] text-rich-red">Contact</dt>
                  <dd className="mt-2 text-base leading-relaxed text-brand-black">
                    {event.contactPerson.name && (
                      <span className="block font-semibold">{event.contactPerson.name}</span>
                    )}
                    {event.contactPerson.email && (
                      <a className="block text-rich-red hover:text-deep-red" href={`mailto:${event.contactPerson.email}`}>
                        {event.contactPerson.email}
                      </a>
                    )}
                    {event.contactPerson.phone && (
                      <a className="block text-rich-red hover:text-deep-red" href={`tel:${event.contactPerson.phone}`}>
                        {event.contactPerson.phone}
                      </a>
                    )}
                  </dd>
                </div>
              )}
            </dl>

            {registrationHref && (
              <TrackedAnchor
                href={registrationHref}
                target="_blank"
                rel="noopener noreferrer"
                eventName="event_registration_click"
                eventParameters={{
                  event_slug: event.slug,
                  campus: campus?.toLowerCase() || 'all',
                  destination_host: new URL(
                    registrationHref,
                    'https://www.ev.church',
                  ).hostname,
                }}
                className="mt-9 inline-flex min-h-12 w-full items-center justify-center bg-rich-red px-6 text-center text-sm font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-deep-red focus:outline-none focus:ring-4 focus:ring-light-red-2"
              >
                Continue to registration
              </TrackedAnchor>
            )}

            <EventSharing event={event} />

            <Link href="/events" className="mt-7 inline-flex font-bold text-rich-red hover:text-deep-red">
              ← Back to all events
            </Link>
          </aside>
        </div>
      </section>
    </div>
  )
}
