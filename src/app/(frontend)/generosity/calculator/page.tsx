import type { Metadata } from 'next'
import { Button } from '@/components/ui/Button'
import { GivingCalculator } from '@/components/generosity/GivingCalculator'
import { faithfulWithMoneyLink } from '@/lib/courses/course-links'

// Publishing or closing enrolment must immediately update the invitation.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Work out my giving',
  description: 'Think through your giving and explore a next step. Your figures stay on your device.',
  alternates: { canonical: 'https://www.ev.church/generosity/calculator' },
}

export default async function GivingCalculatorPage() {
  const course = await faithfulWithMoneyLink()
  return (
    <section className="bg-warm-white px-5 py-20 lg:px-8 lg:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button href="/generosity" variant="text">← Grow in generosity</Button>
          <Button href="https://give.ev.church">Give now</Button>
        </div>
        <h1 className="mt-10 text-h1 leading-heading">Work out my giving</h1>
        <p className="mt-6 mb-10 max-w-3xl text-lg leading-relaxed text-dark-grey">See what you’re giving now as a share of your income, and what a next step could look like.</p>
        <GivingCalculator />
        {course && <aside className="mt-12 rounded-lg border border-warm-grey p-6">
          <h2 className="text-h3 leading-heading">{course.title}</h2>
          <p className="mt-3 mb-5 text-dark-grey">Three evenings to explore faith and money. Take the course alone or with others.</p>
          <Button href={course.href} variant="secondary">Explore the course</Button>
        </aside>}
        <p className="mt-12 border-t border-warm-grey pt-8 text-center text-lg font-semibold">Ready to give? <a href="https://give.ev.church" className="text-deep-red underline underline-offset-4">→ give.ev.church</a></p>
      </div>
    </section>
  )
}
