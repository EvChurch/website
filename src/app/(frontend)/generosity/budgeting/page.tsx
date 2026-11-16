import type { Metadata } from 'next'
import { Button } from '@/components/ui/Button'

export const metadata: Metadata = {
  title: 'Get your budget in order',
  description: 'A simple budgeting course to help you think through where your money goes. Course details coming soon.',
  alternates: { canonical: 'https://www.ev.church/generosity/budgeting' },
  robots: { index: false, follow: true },
}

export default function BudgetingCoursePage() {
  return (
    <section className="bg-warm-white px-5 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-3xl">
        <Button href="/generosity" variant="text">← Grow in generosity</Button>
        <h1 className="mt-8 text-h1 leading-heading">Get your budget in order</h1>
        <p className="mt-6 text-lg leading-relaxed text-dark-grey">Giving well starts with knowing where your money goes. This short course walks you through setting up a simple budget.</p>
        <p className="mt-6 text-lg leading-relaxed text-dark-grey">We’re choosing the budgeting course we’ll use. The course link will be available here once it’s confirmed.</p>
        <p className="mt-6 font-semibold text-dark-grey">Course details coming soon</p>
        <Button href="https://give.ev.church" size="large" className="mt-10">Give now</Button>
      </div>
    </section>
  )
}
