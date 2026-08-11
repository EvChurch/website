import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Daily Bible Reading',
  robots: { index: false, follow: false },
}

export default async function DailyReadingRedirectPage({ params }: { params: Promise<{ readingId: string }> }) {
  const { readingId } = await params
  redirect(`/members/daily-readings/${readingId}`)
}
