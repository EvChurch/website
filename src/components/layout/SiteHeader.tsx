'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import type { MemberImpersonationDisplay } from '@/auth/member-impersonation'
import { Header } from './Header'
import { ImpersonationStrip } from './ImpersonationStrip'
import type { MemberDisplayProfile } from './MemberAccountControl'

export function SiteHeader({ memberProfile, adminHref, impersonation }: {
  memberProfile?: MemberDisplayProfile | null
  adminHref?: string
  impersonation?: MemberImpersonationDisplay | null
}) {
  const [stripHeight, setStripHeight] = useState(0)
  const stripRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = stripRef.current
    if (!element || !impersonation) { setStripHeight(0); return }
    const measure = () => setStripHeight(element.getBoundingClientRect().height)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [impersonation])

  const visible = Boolean(impersonation)
  return <>
    {impersonation && (
      <div className="fixed left-0 right-0 top-0 z-[52]">
        <ImpersonationStrip stripRef={stripRef} impersonation={impersonation} />
      </div>
    )}
    <Header memberProfile={memberProfile} adminHref={adminHref} topOffset={visible ? stripHeight : 0} />
    {visible && (
      <div
        aria-hidden="true"
        data-member-impersonation-spacer
        style={{ height: stripHeight }}
      />
    )}
  </>
}
