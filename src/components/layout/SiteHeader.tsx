'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import type { PublicSiteFeedbackSettings } from '@/lib/site-feedback/settings'
import { FeedbackStrip } from './FeedbackStrip'
import { Header } from './Header'
import type { MemberDisplayProfile } from './MemberAccountControl'

const dismissalKey = (version: string) => `evchurch:site-feedback-dismissed:${version}`

export function SiteHeader({ feedback, memberProfile }: {
  feedback: PublicSiteFeedbackSettings | null
  memberProfile?: MemberDisplayProfile | null
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
    if (!element || dismissed) { setStripHeight(0); return }
    const measure = () => setStripHeight(element.getBoundingClientRect().height)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [dismissed, feedback])

  function dismiss() {
    setStripHeight(0); setDismissed(true)
    if (!feedback) return
    try { localStorage.setItem(dismissalKey(feedback.dismissalVersion), '1') } catch { /* optional */ }
  }

  const visible = feedback !== null && !dismissed
  return <>
    {visible && <div className="fixed left-0 right-0 top-0 z-[52]"><FeedbackStrip stripRef={stripRef} settings={feedback} signedInEmail={memberProfile?.email} onDismiss={dismiss} /></div>}
    <Header memberProfile={memberProfile} topOffset={visible ? stripHeight : 0} />
    {visible && (
      <div
        aria-hidden="true"
        data-site-feedback-spacer
        style={{ height: stripHeight }}
      />
    )}
  </>
}
