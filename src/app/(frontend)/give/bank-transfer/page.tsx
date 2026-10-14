import type { Metadata } from 'next'

import { OpenGivingButton } from '@/components/giving/OpenGivingButton'

export const metadata: Metadata = {
  title: { absolute: 'Give by bank transfer | Ev Church' },
  description: 'Prepare a one-off or recurring gift to Ev Church by internet banking.',
  alternates: { canonical: 'https://www.ev.church/give/bank-transfer' },
}

export default function BankTransferPage() {
  return (
    <section className="bg-brand-black px-4 py-20 text-warm-white sm:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-serif text-5xl italic sm:text-6xl">Give by bank transfer</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-warm-white/80">
          Enter your gift details to prepare personalised internet-banking instructions and references.
        </p>
        <div className="mt-8">
          <OpenGivingButton />
        </div>
      </div>
    </section>
  )
}
