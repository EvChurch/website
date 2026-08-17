import Link from 'next/link'
import { notFound } from 'next/navigation'

export default function GivingPreviewReturnPage() {
  if (process.env.NODE_ENV !== 'development') notFound()

  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand-black/95 p-4">
      <section className="w-full max-w-[26rem] rounded-[1.75rem] bg-warm-white p-8 text-brand-black shadow-2xl">
        <p className="text-sm font-semibold text-rich-red">BlinkPay Sandbox</p>
        <h1 className="mt-3 text-3xl font-semibold">Returned to EV</h1>
        <p className="mt-4 text-lg leading-relaxed text-dark-grey">
          BlinkPay returned you to the local preview. This confirms the hosted return path, but the preview does not create or verify an EV gift record.
        </p>
        <Link href="/give/preview" className="mt-7 flex min-h-14 items-center justify-center rounded-full bg-rich-red px-5 font-semibold text-white transition hover:bg-deep-red">
          Return to giving preview
        </Link>
      </section>
    </main>
  )
}
