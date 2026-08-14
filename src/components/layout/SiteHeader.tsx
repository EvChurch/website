'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import type { PublicSiteFeedbackSettings } from '@/lib/site-feedback/settings'
import type { MemberImpersonationDisplay } from '@/auth/member-impersonation'
import { FeedbackStrip } from './FeedbackStrip'
import { Header } from './Header'
import { ImpersonationStrip } from './ImpersonationStrip'
import type { MemberDisplayProfile } from './MemberAccountControl'

const dismissalKey = (version: string) => `evchurch:site-feedback-dismissed:${version}`

export function SiteHeader({ feedback, memberProfile, adminHref, impersonation }: {
  feedback: PublicSiteFeedbackSettings | null
  memberProfile?: MemberDisplayProfile | null
  adminHref?: string
  impersonation?: MemberImpersonationDisplay | null
}) {
  const [dismissed, setDismissed] = useState(true)
  const [stripHeight, setStripHeight] = useState(0)
  const stripRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!feedback) { setDismissed(true); return }
    try { setDismissed(localStorage.getItem(dismissalKey(feedback.dismissalVersion)) === '1') }
    catch { setDismissed(false) }
  }, [feedback])

  useLayoutEffect(() => {
    const element = stripRef.current
    if (!element || (!impersonation && dismissed)) { setStripHeight(0); return }
    const measure = () => setStripHeight(element.getBoundingClientRect().height)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [dismissed, feedback, impersonation])

  function dismiss() {
    setStripHeight(0); setDismissed(true)
    if (!feedback) return
    try { localStorage.setItem(dismissalKey(feedback.dismissalVersion), '1') } catch { /* optional */ }
  }

  const feedbackVisible = !impersonation && feedback !== null && !dismissed
  const visible = Boolean(impersonation) || feedbackVisible
  return <>
    {visible && (
      <div className="fixed left-0 right-0 top-0 z-[52]">
        {impersonation ? (
          <ImpersonationStrip stripRef={stripRef} impersonation={impersonation} />
        ) : feedback ? (
          <FeedbackStrip stripRef={stripRef} settings={feedback} signedInEmail={memberProfile?.email} onDismiss={dismiss} />
        ) : null}
      </div>
    )}
    <Header memberProfile={memberProfile} adminHref={adminHref} topOffset={visible ? stripHeight : 0} />
    {visible && (
      <div
        aria-hidden="true"
        {...(impersonation
          ? { 'data-member-impersonation-spacer': true }
          : { 'data-site-feedback-spacer': true })}
        style={{ height: stripHeight }}
      />
    )}
  </>
}
