import type { Metadata } from 'next'

import { BankTransferEntry } from '@/components/giving/BankTransferEntry'

export const metadata: Metadata = {
  title: 'Give by bank transfer',
  description: 'Set up your giving to Ev Church through internet banking.',
  alternates: { canonical: 'https://www.ev.church/give/bank-transfer' },
}

export default function BankTransferPage() {
  return <div className="min-h-[70vh] bg-brand-black px-4 py-24 text-warm-white sm:py-32">
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-4xl font-semibold">Give by bank transfer</h1>
      <p className="mb-8">Choose your giving details to get your personal bank reference and instructions for internet banking.</p>
      <BankTransferEntry />
    </div>
  </div>
}
