import Image from 'next/image'
import Link from 'next/link'
import { ScrollReveal } from '@/components/ui/ScrollReveal'

type DataSource = 'campuses' | 'events' | 'team-members'

interface CardGridBlockProps {
  dataSource: DataSource
  campusFilter?: string | null
}

/** Placeholder card displayed while the real data-loading cards are built. */
function PlaceholderCard({ index }: { index: number }) {
  return (
    <div className="group relative overflow-hidden rounded-lg bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="aspect-[4/3] bg-warm-grey/30" />
      <div className="p-6">
        <div className="h-5 w-3/4 rounded bg-warm-grey/40" />
        <div className="mt-3 h-4 w-1/2 rounded bg-warm-grey/30" />
      </div>
    </div>
  )
}

/** Renders a placeholder for a campus card. */
function CampusCard() {
  return (
    <div className="group relative overflow-hidden rounded-lg bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="aspect-[4/3] overflow-hidden bg-warm-grey/20">
        {/* Community photo placeholder */}
        <div className="flex h-full items-center justify-center text-mid-grey">
          <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      </div>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-brand-black">Campus Name</h3>
        <p className="mt-1 text-sm text-mid-grey">Service times and location</p>
      </div>
    </div>
  )
}

/** Renders a placeholder for a team member card. */
function TeamMemberCard() {
  return (
    <div className="group relative overflow-hidden rounded-lg bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="aspect-square overflow-hidden bg-warm-grey/20">
        <div className="flex h-full items-center justify-center text-mid-grey">
          <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      </div>
      <div className="p-6 text-center">
        <h3 className="text-lg font-semibold text-brand-black">Team Member</h3>
        <p className="mt-1 text-sm text-rich-red">Role Title</p>
      </div>
    </div>
  )
}

/** Renders a placeholder for an event card. */
function EventCard() {
  return (
    <div className="group relative overflow-hidden rounded-lg bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="aspect-[4/3] overflow-hidden bg-warm-grey/20">
        <div className="flex h-full items-center justify-center text-mid-grey">
          <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
      <div className="p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-rich-red">Upcoming</p>
        <h3 className="mt-2 text-lg font-semibold text-brand-black">Event Name</h3>
        <p className="mt-1 text-sm text-mid-grey">Date, time, and location</p>
      </div>
    </div>
  )
}

const dataSourceLabels: Record<DataSource, string> = {
  campuses: 'Our Campuses',
  events: 'Upcoming Events',
  'team-members': 'Our Team',
}

const cardRenderers: Record<DataSource, () => React.JSX.Element> = {
  campuses: CampusCard,
  events: EventCard,
  'team-members': TeamMemberCard,
}

export function CardGridBlockComponent({ dataSource, campusFilter }: CardGridBlockProps) {
  const CardComponent = cardRenderers[dataSource]
  const placeholderCount = dataSource === 'team-members' ? 6 : 3

  return (
    <section className="bg-warm-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
        <ScrollReveal>
          <h2 className="text-center text-[length:var(--text-h2)] leading-[var(--leading-heading)] text-brand-black">
            {dataSourceLabels[dataSource]}
          </h2>
        </ScrollReveal>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: placeholderCount }, (_, i) => (
            <ScrollReveal key={i} delay={i * 100}>
              <CardComponent />
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
