import type { Metadata } from 'next'
import { Albert_Sans } from 'next/font/google'
import type { ReactNode } from 'react'

import '@/styles/globals.css'

const albertSans = Albert_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-albert-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Giving preview',
  robots: { index: false, follow: false },
}

export default function GivingPreviewLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={albertSans.variable}>
      <body className="bg-brand-black font-sans text-brand-black antialiased">{children}</body>
    </html>
  )
}
