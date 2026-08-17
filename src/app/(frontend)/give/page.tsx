import type { Metadata } from 'next'

import { OpenGivingButton } from '@/components/giving/OpenGivingButton'

export const metadata: Metadata = {
  title: 'Giving at Ev',
  description: 'Start a gift to Ev Church and learn why giving supports gospel ministry across Auckland and New Zealand.',
  alternates: { canonical: 'https://www.ev.church/give' },
  openGraph: {
    title: 'Giving at Ev',
    description: 'Start a gift to Ev Church and learn why giving supports gospel ministry across Auckland and New Zealand.',
    url: 'https://www.ev.church/give',
  },
}

export default function GivePage() {
  return (
    <article className="bg-brand-black text-white">
      <section className="mx-auto flex min-h-[72svh] max-w-[80rem] items-center px-5 pb-20 pt-36 lg:px-8 lg:pt-44">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-rich-red">Giving</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">Giving at Ev</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75 sm:text-xl">
            We’re preparing this page with more about why giving is good and how it supports gospel ministry at Ev.
          </p>
          <div className="mt-9">
            <OpenGivingButton />
          </div>
        </div>
      </section>
    </article>
  )
}
