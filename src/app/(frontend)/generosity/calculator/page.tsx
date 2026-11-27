import type { Metadata } from 'next'
import { Button } from '@/components/ui/Button'
import { OpenGivingButton } from '@/components/giving/OpenGivingButton'
import { GivingCalculator } from '@/components/generosity/GivingCalculator'
import { faithfulWithMoneyLink } from '@/lib/courses/course-links'

// Publishing or closing enrolment must immediately update the invitation.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Help me work out my giving',
  description:
    'Think through your giving and explore a next step. Your figures stay on your device.',
  alternates: { canonical: 'https://www.ev.church/generosity/calculator' },
}

export default async function GivingCalculatorPage() {
  const course = await faithfulWithMoneyLink()
  return (
    <section className="bg-warm-white px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-h1 leading-heading">
          Help me work out my giving
        </h1>
        <p className="mt-6 mb-10 max-w-3xl text-lg leading-relaxed text-dark-grey">
          Put in your household income and what you currently give, and we’ll
          show you where it all lands — and what growing in generosity could
          look like.
        </p>
        <GivingCalculator />
        <div className={`mt-12 grid gap-5 ${course ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          <section className="flex flex-col items-start rounded-xl border border-warm-grey bg-white p-6">
            <h2 className="text-xl font-bold">Money is tight</h2>
            <p className="mt-3 mb-6 text-dark-grey">
              Speak with your Connect Group leader or contact us for support.
            </p>
            <div className="mt-auto">
              <Button href="/contact" variant="secondary">Contact us</Button>
            </div>
          </section>
          {course && (
            <section className="flex flex-col items-start rounded-xl border border-warm-grey bg-white p-6">
              <h2 className="text-xl font-bold">{course.title}</h2>
              <p className="mt-3 mb-6 text-dark-grey">
                Three evenings to explore faith and money. Explore at your pace or
                learn with a group.
              </p>
              <div className="mt-auto">
                <Button href={course.href} variant="secondary">Explore the course</Button>
              </div>
            </section>
          )}
          <section className="flex flex-col items-start rounded-xl border border-warm-grey bg-white p-6">
            <h2 className="text-xl font-bold">Ready to give?</h2>
            <p className="mt-3 mb-6 text-dark-grey">Set up your giving to Ev.</p>
            <div className="mt-auto"><OpenGivingButton variant="secondary" /></div>
          </section>
        </div>
      </div>
    </section>
  )
}
