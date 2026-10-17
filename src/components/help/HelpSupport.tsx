import Link from 'next/link'
import { loadSiteFeedbackSettings } from '@/lib/site-feedback/settings'

export async function HelpSupport() {
  const feedback = await loadSiteFeedbackSettings()
  return <section className="mt-12 flex flex-wrap items-center justify-between gap-6 rounded-xl border border-warm-grey bg-white p-6">
    <div><h2 className="text-xl">Still need help?</h2><p className="mt-2 text-sm text-dark-grey">Get in touch if you need a hand or something isn’t working.</p></div>
    <div className="flex flex-wrap gap-3"><Link href="/contact" className="rounded-lg bg-rich-red px-4 py-3 text-sm font-bold text-white">Contact us</Link><Link href={feedback ? '?launcher=feedback' : '/contact'} className="rounded-lg border border-warm-grey px-4 py-3 text-sm font-semibold">Report a problem with the site</Link></div>
  </section>
}
