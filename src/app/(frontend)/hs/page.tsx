import type { Metadata } from 'next'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import { Button } from '@/components/ui/Button'

export const metadata: Metadata = {
  title: 'Health & Safety | Ev Church Auckland',
  description:
    'Ev Church is committed to providing a safe environment for everyone. Learn about our health and safety policies and resources.',
  openGraph: {
    title: 'Health & Safety | Ev Church Auckland',
    description: 'Health and safety information for Ev Church Auckland.',
    url: 'https://www.ev.church/hs',
    siteName: 'Ev Church',
    locale: 'en_NZ',
    type: 'website',
  },
  alternates: {
    canonical: 'https://www.ev.church/hs',
  },
}

const resources = [
  {
    title: 'Emergency procedures',
    description:
      'Our campuses have clearly marked exits, first aid kits, and trained personnel. In an emergency, follow the instructions of our safety team.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
  },
  {
    title: 'Child safety',
    description:
      'All Ev Kids and Ev Youth volunteers are police vetted. We maintain strict sign-in and sign-out procedures for all children and youth programs.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    title: 'First aid',
    description:
      'Trained first aiders are present at every service and event. First aid kits and AED defibrillators are available at all campuses.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
  },
  {
    title: 'Accessibility',
    description:
      'Our campuses are wheelchair accessible with designated parking, ramp access, and accessible restrooms. Contact us if you need specific assistance.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    title: 'Reporting concerns',
    description:
      'If you have any health and safety concerns, please speak to a team member or contact us directly. All reports are taken seriously and handled confidentially.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
      </svg>
    ),
  },
  {
    title: 'Food safety',
    description:
      'Our cafe and event catering follow food safety guidelines. If you have allergies or dietary requirements, please let our team know.',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.379a48.474 48.474 0 00-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265zm-3 0a.375.375 0 11-.53 0L9 2.845l.265.265zm6 0a.375.375 0 11-.53 0L15 2.845l.265.265z" />
      </svg>
    ),
  },
]

export default function HealthSafetyPage() {
  return (
    <>
      {/* CTA Banner */}
      <section className="bg-rich-red px-5 py-6 lg:px-8">
        <div className="mx-auto flex max-w-[80rem] flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-semibold text-white">
            If you are experiencing an emergency, call 111 immediately.
          </p>
          <a
            href="/contact"
            className="inline-flex items-center justify-center rounded-md bg-white px-5 py-2 text-sm font-semibold text-rich-red transition-all duration-200 hover:bg-warm-white active:scale-[0.97]"
          >
            Report a concern
          </a>
        </div>
      </section>

      {/* Hero / Overview */}
      <section className="bg-warm-white px-5 py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-[80rem]">
          <div className="mx-auto max-w-3xl text-center">
            <ScrollReveal>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
                Your safety matters
              </p>
              <h1 className="mt-3 text-display leading-display text-brand-black">
                Health &amp; Safety
              </h1>
              <p className="mt-6 text-lg leading-body-lg text-dark-grey">
                Ev Church is committed to providing a safe, healthy, and welcoming
                environment for everyone who walks through our doors. We take our
                responsibilities seriously and work to ensure our campuses, programs,
                and events meet the highest standards of care.
              </p>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Resources / Links */}
      <section className="bg-white px-5 py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-[80rem]">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
              Our commitment
            </p>
            <h2 className="mt-3 text-h2 leading-heading text-brand-black">
              Policies and resources
            </h2>
          </ScrollReveal>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {resources.map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 80}>
                <div className="h-full rounded-xl border border-warm-grey/60 bg-warm-white p-8 transition-all duration-300 hover:border-rich-red/20 hover:shadow-lg hover:shadow-rich-red/5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-light-red-3/30 text-rich-red">
                    {item.icon}
                  </div>
                  <h3 className="mt-5 font-sans text-h4 font-bold text-brand-black">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-[0.9375rem] leading-relaxed text-mid-grey">
                    {item.description}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="bg-warm-white px-5 py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <ScrollReveal>
            <h2 className="text-h2 leading-heading text-brand-black">
              Have a concern?
            </h2>
            <p className="mt-5 text-lg leading-body-lg text-dark-grey">
              Your safety is our priority. If you have any health and safety
              questions or need to report a concern, please get in touch.
              All reports are handled confidentially.
            </p>
            <div className="mt-10">
              <Button href="/contact" size="large">
                Contact us
              </Button>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  )
}
