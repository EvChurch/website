import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import RichText from '@/components/blocks/RichTextRenderer'
import { EventImage } from '@/components/events/EventImage'
import { EventStatus } from '@/components/events/EventStatus'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { EventJsonLd } from '@/components/seo/EventJsonLd'
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
  const url = `https://ev.church/events/${event.slug}`

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
      ...(image?.url ? { images: [{ url: image.url, alt: image.alt || event.title }] } : {}),
    },
  }
}

export default async function EventDetailPage({ params }: Props) {
  const { slug } = await params
  const event = await getEventBySlug(slug)
  if (!event) notFound()

  const past = isPastEvent(event)
  const campus = getCampusName(event)
  const registrationHref = !past ? getRegistrationHref(event) : null

  return (
    <div className="bg-warm-white">
      <EventJsonLd event={event} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: 'https://ev.church' },
          { name: 'Events', url: 'https://ev.church/events' },
          { name: event.title, url: `https://ev.church/events/${event.slug}` },
        ]}
      />

      <section className="relative flex min-h-[70vh] items-end overflow-hidden bg-brand-black text-white">
        <EventImage event={event} priority sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/55 to-brand-black/15" />
        <div className="relative mx-auto w-full max-w-[80rem] px-5 pb-16 pt-40 lg:px-8 lg:pb-20">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-light-red-2">
            {past ? 'Past event' : 'Upcoming event'}
          </p>
          <h1 className="mt-5 max-w-5xl text-[clamp(3.5rem,9vw,8rem)] leading-[0.88] tracking-[-0.045em] text-white">
            {event.title}
          </h1>
          <p className="mt-7 max-w-3xl text-sm font-semibold uppercase tracking-[0.12em] text-white/80 sm:text-base">
            {formatEventDate(event)}
            {campus ? ` · ${campus}` : ''}
          </p>
        </div>
      </section>

      <section className="px-5 py-16 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-[80rem] gap-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-20">
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
              {event.contactPerson?.name && (
                <div>
                  <dt className="text-xs font-bold uppercase tracking-[0.16em] text-rich-red">Contact</dt>
                  <dd className="mt-2 text-base leading-relaxed text-brand-black">
                    <span className="block font-semibold">{event.contactPerson.name}</span>
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
              <a
                href={registrationHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-9 inline-flex min-h-12 w-full items-center justify-center bg-rich-red px-6 text-center text-sm font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-deep-red focus:outline-none focus:ring-4 focus:ring-light-red-2"
              >
                Continue to registration
              </a>
            )}

            <Link href="/events" className="mt-7 inline-flex font-bold text-rich-red hover:text-deep-red">
              ← Back to all events
            </Link>
          </aside>
        </div>
      </section>
    </div>
  )
}
