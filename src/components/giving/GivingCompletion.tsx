'use client'

import { CompletionCelebration } from '@/components/shared/CompletionCelebration'
import type { GivingCheckoutStatusGift } from '@/lib/giving/contracts'

const currency = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' })
const date = new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', day: 'numeric', month: 'short', year: 'numeric' })

function formatAmount(amountMinor: number) {
  return currency.format(amountMinor / 100)
}

function frequencyLabel(value: GivingCheckoutStatusGift['frequency']) {
  return value === 'one-off'
    ? 'Just this once'
    : value === 'weekly'
      ? 'Every week'
      : value === 'fortnightly'
        ? 'Every two weeks'
        : value === 'monthly'
          ? 'Every month'
          : value === 'annual'
            ? 'Every year'
            : 'Every day'
}

function GiftDetails({ gift }: { gift: GivingCheckoutStatusGift }) {
  const totalMinor = gift.amountMinor + gift.transactionFeeMinor
  return <dl className="mt-5 grid gap-3 border-y border-warm-grey py-4 text-sm sm:grid-cols-2">
    <div>
      <dt className="font-bold text-brand-black">Gift</dt>
      <dd className="mt-1 text-dark-grey">{formatAmount(gift.amountMinor)}</dd>
    </div>
    {gift.transactionFeeMinor > 0 && (
      <div>
        <dt className="font-bold text-brand-black">Transaction fee</dt>
        <dd className="mt-1 text-dark-grey">{formatAmount(gift.transactionFeeMinor)}</dd>
      </div>
    )}
    {gift.transactionFeeMinor > 0 && (
      <div>
        <dt className="font-bold text-brand-black">Total charged</dt>
        <dd className="mt-1 text-dark-grey">{formatAmount(totalMinor)}</dd>
      </div>
    )}
    <div>
      <dt className="font-bold text-brand-black">Fund</dt>
      <dd className="mt-1 text-dark-grey">{gift.fundName}</dd>
    </div>
    <div>
      <dt className="font-bold text-brand-black">Schedule</dt>
      <dd className="mt-1 text-dark-grey">{frequencyLabel(gift.frequency)}</dd>
    </div>
    {gift.frequency !== 'one-off' && gift.firstPaymentDate && (
      <div>
        <dt className="font-bold text-brand-black">Starts</dt>
        <dd className="mt-1 text-dark-grey">{date.format(new Date(gift.firstPaymentDate))}</dd>
      </div>
    )}
  </dl>
}

export function GivingCompletion({
  firstName,
  kind,
  gift,
  onDone,
}: {
  firstName?: string
  kind: 'bank-transfer' | 'one-off' | 'recurring'
  gift?: GivingCheckoutStatusGift
  onDone: () => void
}) {
  const greeting = firstName?.trim() ? `Thank you, ${firstName.trim()}` : 'Thank you'
  const confirmation = kind === 'bank-transfer'
    ? 'We’ve recorded that you’ve set up your bank transfer. Your bank will make the transfer; Ev hasn’t verified a payment yet.'
    : kind === 'recurring'
      ? 'Your recurring gift is confirmed and its schedule is active.'
      : 'Your gift is confirmed.'

  return <article className="relative overflow-hidden py-1">
    <CompletionCelebration />
    <div className="relative z-10">
      <p className="text-2xl font-semibold leading-tight text-brand-black">{greeting}</p>
      <p role="status" className="mt-3 leading-relaxed text-dark-grey">{confirmation}</p>
      {gift && <GiftDetails gift={gift} />}
      <blockquote className="mt-5 rounded-2xl bg-warm-grey/35 px-5 py-4">
        <p className="font-serif text-lg leading-relaxed text-brand-black">“Each person should do as he has decided in his heart—not reluctantly or out of compulsion, since God loves a cheerful giver.”</p>
        <cite className="mt-3 block text-xs font-bold not-italic uppercase tracking-[0.12em] text-mid-grey">2 Corinthians 9:7</cite>
      </blockquote>
      <p className="mt-4 leading-relaxed text-dark-grey">Your generosity helps sustain gospel ministry across Ev—from church life and the next generation to training workers and planting churches. Thank you for the part you’re playing.</p>
      <button type="button" onClick={onDone} className="mt-5 min-h-14 w-full rounded-full bg-rich-red px-5 font-semibold text-white transition hover:bg-deep-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red focus-visible:ring-offset-2">Done</button>
    </div>
  </article>
}

export function GivingPreparation({ mode }: { mode: 'blinkpay' | 'bank-transfer' }) {
  const bankTransfer = mode === 'bank-transfer'
  return <div className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-warm-grey/60" role="status">
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warm-grey/35" aria-hidden="true">
      <div className="relative h-8 w-8">
        <span className="absolute inset-0 rounded-full border-2 border-warm-grey" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-rich-red motion-reduce:animate-none" />
        <span className="absolute inset-2 rounded-full bg-rich-red/15 motion-safe:animate-pulse" />
      </div>
    </div>
    <p className="mt-5 text-center leading-relaxed text-dark-grey">{bankTransfer ? 'We’re creating your personal reference so your gift can be matched correctly.' : 'We’re securely connecting you with BlinkPay and your bank.'} Please wait.</p>
  </div>
}
