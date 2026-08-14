import type { Metadata } from 'next'
import Link from 'next/link'

import { getSitemapSections } from '@/lib/sitemap'
import { DEFAULT_OPEN_GRAPH_IMAGES } from '@/lib/seo-metadata'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sitemap | Ev Church Auckland',
  description: 'Browse the Ev Church sitemap to find every public page, including campuses, events, sermons, ministries, Christian resources, and ways to connect.',
  alternates: { canonical: '/sitemap' },
  openGraph: {
    images: DEFAULT_OPEN_GRAPH_IMAGES,
    title: 'Sitemap | Ev Church Auckland',
    description: 'Browse every public page on the Ev Church website.',
    url: '/sitemap',
    siteName: 'Ev Church',
    locale: 'en_NZ',
    type: 'website',
  },
}

function pathname(url: string): string {
  return new URL(url).pathname
}

export default async function SitemapPage() {
  const sections = (await getSitemapSections()).filter((section) => section.links.length > 0)

  return (
    <main className="bg-warm-white px-5 py-24 lg:px-8 lg:py-32">
      <div className="mx-auto max-w-[80rem]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
          Explore
        </p>
        <h1 className="mt-3 text-display leading-display text-brand-black">Sitemap</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-dark-grey">
          Browse all public pages, events, articles, and sermon resources on the Ev Church website.
        </p>

        <div className="mt-14 grid gap-x-12 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => (
            <section key={section.title} aria-labelledby={`sitemap-${section.title.toLowerCase().replaceAll(' ', '-')}`}>
              <h2
                id={`sitemap-${section.title.toLowerCase().replaceAll(' ', '-')}`}
                className="border-b border-warm-grey/60 pb-3 text-h3 text-brand-black"
              >
                {section.title}
              </h2>
              <ul className="mt-5 space-y-3">
                {section.links.map((item) => (
                  <li key={item.url}>
                    <Link
                      href={pathname(item.url)}
                      className="text-[0.9375rem] leading-relaxed text-dark-grey transition-colors hover:text-rich-red"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
