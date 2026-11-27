'use client'

import Link from 'next/link'
import { useId, useRef, useState } from 'react'
import { ReimbursementMenuLink } from './ReimbursementMenuLink'

interface MemberNavigationLink {
  key: string
  label: string
  href: string
}

export function MemberNavigation({ links, active }: { links: MemberNavigationLink[]; active?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const toggle = useRef<HTMLButtonElement>(null)
  const current = links.find(link => link.key === active)?.label
    ?? (active === 'reimbursements' ? 'Reimbursements' : active === 'help' ? 'Help' : '')

  return <nav aria-label="Members" className="border-b border-warm-grey bg-white" onKeyDown={event => {
    if (event.key === 'Escape' && open) {
      setOpen(false)
      toggle.current?.focus()
    }
  }}>
    <div className="mx-auto max-w-[80rem] px-5 sm:px-8">
      <button ref={toggle} type="button" aria-expanded={open} aria-controls={id}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 py-4 text-sm font-bold lg:hidden">
        <span>Member menu</span>
        <span className="flex items-center gap-2 text-rich-red">{current}<svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.5" /></svg></span>
      </button>
      <div id={id} className={`${open ? 'grid' : 'hidden'} grid-cols-2 gap-x-5 gap-y-1 border-t border-warm-grey py-2 lg:flex lg:flex-wrap lg:border-0 lg:py-0`}
        onClick={() => setOpen(false)}>
        {links.map(link => <Link key={link.key} href={link.href} rel="nofollow"
          aria-current={active === link.key ? 'page' : undefined}
          className={`relative min-w-0 py-3 text-sm font-bold transition-colors lg:shrink-0 lg:py-5 ${active === link.key ? 'text-rich-red' : 'text-dark-grey hover:text-rich-red'}`}>
          {link.label}{active === link.key && <span className="absolute inset-x-0 bottom-0 h-1 bg-rich-red" />}
        </Link>)}
        <ReimbursementMenuLink active={active === 'reimbursements'} />
        <Link href="/help" rel="nofollow" aria-current={active === 'help' ? 'page' : undefined}
          className="relative min-w-0 py-3 text-sm font-bold text-dark-grey transition-colors hover:text-rich-red lg:shrink-0 lg:py-5">Help</Link>
      </div>
    </div>
  </nav>
}
