'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

/** The member menu stays uncluttered until this person has opened reimbursements. */
export function ReimbursementMenuLink({ active }: { active: boolean }) {
  const [enabled, setEnabled] = useState(active)
  useEffect(() => {
    let current = true
    void fetch('/api/reimbursements/menu', { cache: 'no-store' }).then(response => response.ok ? response.json() : null)
      .then(data => { if (current && data?.enabled) setEnabled(true) }).catch(() => undefined)
    return () => { current = false }
  }, [])
  if (!enabled) return null
  return <Link href="/members/reimbursements" rel="nofollow" aria-current={active ? 'page' : undefined} className={`relative shrink-0 py-5 text-sm font-bold ${active ? 'text-rich-red' : 'text-dark-grey hover:text-rich-red'}`}>Reimbursements{active && <span className="absolute inset-x-0 bottom-0 h-1 bg-rich-red" />}</Link>
}
