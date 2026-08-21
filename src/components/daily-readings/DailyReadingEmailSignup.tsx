'use client'

import { useState } from 'react'

export function DailyReadingEmailSignup({
  initiallySubscribed,
}: {
  initiallySubscribed: boolean
}) {
  const [state, setState] = useState<
    'available' | 'submitting' | 'subscribed' | 'error'
  >(initiallySubscribed ? 'subscribed' : 'available')

  if (state === 'subscribed' && initiallySubscribed) return null

  const subscribe = async () => {
    setState('submitting')
    try {
      const response = await fetch('/api/member-daily-reading-email', {
        method: 'POST',
      })
      if (!response.ok) throw new Error('signup failed')
      setState('subscribed')
    } catch {
      setState('error')
    }
  }

  return (
    <section
      aria-labelledby="daily-reading-email-signup-heading"
      className="mt-14 overflow-hidden rounded-2xl bg-brand-black text-white"
    >
      <div className="flex flex-col gap-6 px-6 py-7 sm:px-8 sm:py-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-hero-eyebrow">
            Daily Bible Reading emails
          </p>
          <h2
            id="daily-reading-email-signup-heading"
            className="mt-2 text-3xl text-warm-white"
          >
            Get the readings in your inbox.
          </h2>
          <p className="mt-3 leading-relaxed text-white/70">
            Sign up to receive Ev Church’s Daily Bible Reading emails each weekday.
          </p>
        </div>
        {state === 'subscribed' ? (
          <p role="status" className="shrink-0 font-bold text-warm-white">
            You’re signed up.
          </p>
        ) : (
          <button
            type="button"
            disabled={state === 'submitting'}
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-md bg-rich-red px-6 text-sm font-bold text-white transition-colors hover:bg-deep-red disabled:cursor-wait disabled:opacity-70"
            onClick={() => void subscribe()}
          >
            {state === 'submitting' ? 'Signing you up…' : 'Sign up for emails'}
          </button>
        )}
      </div>
      {state === 'error' && (
        <p role="alert" className="border-t border-white/15 px-6 py-4 text-sm text-white sm:px-8">
          We couldn’t sign you up right now. Please try again.
        </p>
      )}
    </section>
  )
}
