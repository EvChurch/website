import { notFound } from 'next/navigation'

import { GivingPreview } from '@/components/giving/GivingPreview'

export default function GivingPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound()

  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand-black/95 p-4">
      <GivingPreview />
    </main>
  )
}
