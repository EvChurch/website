import type { Metadata } from 'next'
import '@/styles/globals.css'
export const metadata: Metadata = { title: 'Article review | Ev Church', robots: { index: false, follow: false }, referrer: 'no-referrer' }
// Private capability links must not enter analytics or the public site shell.
export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
