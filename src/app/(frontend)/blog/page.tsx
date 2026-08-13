import type { Metadata } from 'next'
import Link from 'next/link'

import { MediaImage } from '@/components/media/MediaImage'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import {
  formatBlogDate,
  getBlogImage,
  getPublishedBlogPosts,
} from '@/lib/blog'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Blog | Ev Church Auckland',
  description:
    'Stories and reflections from Ev Church Auckland. Faith, community, and life in Tamaki Makaurau.',
  openGraph: {
    title: 'Blog | Ev Church Auckland',
    description: 'Stories, reflections, and updates from Ev Church Auckland.',
    url: 'https://www.ev.church/blog',
    siteName: 'Ev Church',
    locale: 'en_NZ',
    type: 'website',
  },
  alternates: {
    canonical: 'https://www.ev.church/blog',
  },
}

export default async function BlogPage() {
  const posts = await getPublishedBlogPosts()

  return (
    <>
      <section className="bg-warm-white px-5 pb-16 pt-24 lg:px-8 lg:pb-20 lg:pt-32">
        <div className="mx-auto max-w-[80rem]">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
              Stories and reflections
            </p>
            <h1 className="mt-3 text-display leading-display text-brand-black">Blog</h1>
            <p className="mt-6 max-w-xl text-lg leading-body-lg text-dark-grey">
              Thoughts on faith, community, and life at Ev Church.
            </p>
          </ScrollReveal>
        </div>
      </section>

      <section className="bg-warm-white px-5 pb-24 lg:px-8 lg:pb-32">
        <div className="mx-auto max-w-[80rem]">
          {posts.length > 0 ? (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, index) => {
                const image = getBlogImage(post)

                return (
                  <ScrollReveal key={post.id} delay={index * 80} className="h-full">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="group flex h-full flex-col overflow-hidden rounded-xl border border-warm-grey/60 bg-white transition-all duration-300 hover:border-rich-red/20 hover:shadow-lg hover:shadow-rich-red/5"
                    >
                      <div className="relative aspect-[16/10] overflow-hidden bg-brand-black">
                        {image?.url ? (
                          <MediaImage
                            media={image}
                            mediaSize="medium"
                            fill
                            sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-end bg-[linear-gradient(145deg,#0f0004,#381611)] p-6">
                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-hero-eyebrow">
                              Ev Church
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-rich-red">
                          Blog
                        </p>
                        <h2 className="mt-2 text-h4 leading-snug text-brand-black transition-colors group-hover:text-rich-red">
                          {post.title}
                        </h2>
                        {post.excerpt && (
                          <p className="mt-3 text-sm leading-relaxed text-mid-grey">{post.excerpt}</p>
                        )}
                        <div className="mt-auto flex items-center gap-2 pt-5 text-xs text-mid-grey">
                          <span>{post.author}</span>
                          <span aria-hidden="true" className="text-warm-grey">|</span>
                          <time dateTime={post.publishedDate}>{formatBlogDate(post.publishedDate)}</time>
                        </div>
                      </div>
                    </Link>
                  </ScrollReveal>
                )
              })}
            </div>
          ) : (
            <p className="border-t border-warm-grey/60 py-16 text-lg text-dark-grey">
              There are no published posts yet. Please check back soon.
            </p>
          )}
        </div>
      </section>
    </>
  )
}
