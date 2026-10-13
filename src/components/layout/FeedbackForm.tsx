'use client'

import { FormEvent, useEffect, useId, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { TurnstileWidget } from '@/components/forms/TurnstileWidget'
import { SITE_FEEDBACK_TURNSTILE_ACTION } from '@/lib/site-feedback/constants'
import type { PublicSiteFeedbackSettings } from '@/lib/site-feedback/settings'

const SUBMISSION_TIMEOUT_MS = 45_000

function retryAfterSeconds(value: string | null): number | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed)
    return Number.isSafeInteger(seconds) ? seconds : null
  }
  const retryAt = Date.parse(trimmed)
  if (Number.isNaN(retryAt)) return null
  return Math.max(0, Math.ceil((retryAt - Date.now()) / 1_000))
}

export function FeedbackForm({
  settings,
  signedInEmail,
  onClose,
}: {
  settings: PublicSiteFeedbackSettings
  signedInEmail?: string
  onClose?: () => void
}) {
  const [comment, setComment] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileReset, setTurnstileReset] = useState(0)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [complete, setComplete] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const titleId = useId()
  const descriptionId = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const submissionControllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      submissionControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = window.setTimeout(
      () => setCooldownSeconds((seconds) => Math.max(0, seconds - 1)),
      1_000,
    )
    return () => window.clearTimeout(timer)
  }, [cooldownSeconds])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || cooldownSeconds > 0) return
    const normalizedComment = comment.trim()
    if (!normalizedComment) { setError('Please enter your feedback.'); textareaRef.current?.focus(); return }
    const submissionEmail = signedInEmail?.trim() || email.trim()
    if (!submissionEmail) { setError('Please enter your email address.'); return }
    if (!turnstileToken) { setError('Please complete the security check.'); return }
    const controller = new AbortController()
    submissionControllerRef.current = controller
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, SUBMISSION_TIMEOUT_MS)
    setPending(true); setError('')
    try {
      const postHogReplayUrl = posthog.get_session_replay_url({
        withTimestamp: true,
      })
      const response = await fetch('/api/site-feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          comment: normalizedComment,
          email: submissionEmail,
          sourceUrl: window.location.href,
          ...(postHogReplayUrl ? { postHogReplayUrl } : {}),
          website,
          turnstileToken,
        }),
      })
      const result = (await response.json().catch(() => ({}))) as { error?: unknown }
      if (!response.ok) {
        if (response.status === 429) {
          const seconds = retryAfterSeconds(response.headers.get('Retry-After'))
          if (seconds !== null && seconds > 0) {
            setCooldownSeconds(seconds)
            throw new Error(
              `Too many requests. Try again in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.`,
            )
          }
        }
        throw new Error(typeof result.error === 'string' ? result.error : 'We could not send your feedback. Please try again.')
      }
      setComplete(true)
    } catch (submissionError) {
      if (!mountedRef.current) return
      setError(
        timedOut
          ? 'The request took too long. Please try again.'
          : submissionError instanceof Error
            ? submissionError.message
            : 'We could not send your feedback. Please try again.',
      )
      setTurnstileToken(''); setTurnstileReset((value) => value + 1)
    } finally {
      window.clearTimeout(timeout)
      if (submissionControllerRef.current === controller) {
        submissionControllerRef.current = null
      }
      if (mountedRef.current) setPending(false)
    }
  }

  const content = complete ? (
    <div className="py-8 text-center" role="status">
      <h3 className="text-2xl text-brand-black">Thank you for your feedback</h3>
      <p className="mt-3 text-sm text-dark-grey">We appreciate you helping us improve ev.church.</p>
      <button type="button" className="mt-6 rounded-full bg-rich-red px-6 py-3 text-sm font-semibold text-white hover:bg-deep-red" onClick={onClose}>Close</button>
    </div>
  ) : (
    <form className="space-y-5" onSubmit={submit}>
      <div><label htmlFor={`${titleId}-comment`} className="block text-sm font-semibold text-brand-black">Feedback</label><textarea ref={textareaRef} id={`${titleId}-comment`} name="comment" required maxLength={4000} rows={5} value={comment} onChange={(event) => setComment(event.target.value)} className="mt-2 w-full resize-y rounded-lg border border-mid-grey/40 bg-white px-4 py-3 text-base outline-none focus:border-rich-red focus:ring-2 focus:ring-rich-red/20" /></div>
      {!signedInEmail && <div><label htmlFor={`${titleId}-email`} className="block text-sm font-semibold text-brand-black">Email</label><input id={`${titleId}-email`} name="email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-mid-grey/40 bg-white px-4 py-3 text-base outline-none focus:border-rich-red focus:ring-2 focus:ring-rich-red/20" /></div>}
      <div className="absolute -left-[9999px]" aria-hidden="true"><label htmlFor={`${titleId}-website`}>Website</label><input id={`${titleId}-website`} name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></div>
      <TurnstileWidget siteKey={settings.turnstileSiteKey} action={SITE_FEEDBACK_TURNSTILE_ACTION} resetKey={turnstileReset} onToken={setTurnstileToken} onError={setError} />
      {error && <p role="alert" className="text-sm font-medium text-rich-red">{error}</p>}
      <button type="submit" disabled={pending || cooldownSeconds > 0} className="w-full rounded-full bg-rich-red px-6 py-3 text-sm font-semibold text-white hover:bg-deep-red disabled:opacity-60">{pending ? 'Sending…' : cooldownSeconds > 0 ? `Try again in ${cooldownSeconds}s` : 'Send feedback'}</button>
    </form>
  )

  return <div className="animate-fade-in motion-reduce:animate-none">
    <p id={descriptionId} className="mb-6 text-sm leading-6 text-dark-grey">{settings.modalIntro}</p>
    {content}
  </div>
}
