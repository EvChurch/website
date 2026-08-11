import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Daily Bible Reading',
  robots: { index: false, follow: false },
}

export default function DailyReadingsRedirectPage() {
  redirect('/members/daily-readings')
}
