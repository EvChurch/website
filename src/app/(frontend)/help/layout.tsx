import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: { default: 'Help', template: '%s | Ev Church Help' },
  description: 'Practical guides for using church systems and getting things done at Ev Church.',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export default function HelpLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-[65vh] bg-warm-white"><div className="mx-auto max-w-[80rem] px-5 py-10 sm:px-8 sm:py-14">{children}</div></div>
}
