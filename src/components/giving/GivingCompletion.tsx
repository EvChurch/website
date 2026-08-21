'use client'

import { CompletionCelebration } from '@/components/shared/CompletionCelebration'

export function GivingCompletion({
  firstName,
  kind,
  onDone,
}: {
  firstName?: string
  kind: 'bank-transfer' | 'one-off' | 'recurring'
  onDone: () => void
}) {
  const greeting = firstName?.trim() ? `Thank you, ${firstName.trim()}` : 'Thank you'
  const confirmation = kind === 'bank-transfer'
    ? 'We’ve recorded that you’ve set up your bank transfer. Your bank will make the transfer; Ev hasn’t verified a payment yet.'
    : kind === 'recurring'
      ? 'Your recurring gift is confirmed and its schedule is active.'
      : 'Your gift is confirmed.'

  return <article className="relative overflow-hidden rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-warm-grey/60">
    <CompletionCelebration />
    <div className="relative z-10">
      <p className="text-2xl font-semibold leading-tight text-brand-black">{greeting}</p>
      <p role="status" className="mt-4 leading-relaxed text-dark-grey">{confirmation}</p>
      <blockquote className="mt-6 rounded-2xl bg-warm-grey/35 px-5 py-4">
        <p className="font-serif text-lg leading-relaxed text-brand-black">“Each person should do as he has decided in his heart—not reluctantly or out of compulsion, since God loves a cheerful giver.”</p>
        <cite className="mt-3 block text-xs font-bold not-italic uppercase tracking-[0.12em] text-mid-grey">2 Corinthians 9:7</cite>
      </blockquote>
      <p className="mt-5 leading-relaxed text-dark-grey">Your generosity helps sustain gospel ministry across Ev—from church life and the next generation to training workers and planting churches. Thank you for the part you’re playing.</p>
      <button type="button" onClick={onDone} className="mt-6 min-h-14 w-full rounded-full bg-rich-red px-5 font-semibold text-white transition hover:bg-deep-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-red focus-visible:ring-offset-2">Done</button>
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
