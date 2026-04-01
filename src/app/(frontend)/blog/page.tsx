import type { Metadata } from 'next'
import Link from 'next/link'
import { ScrollReveal } from '@/components/ui/ScrollReveal'

export const metadata: Metadata = {
  title: 'Blog | Ev Church Auckland',
  description:
    'Stories and reflections from Ev Church Auckland. Faith, community, and life in Tamaki Makaurau.',
  openGraph: {
    title: 'Blog | Ev Church Auckland',
    description: 'Stories, reflections, and updates from Ev Church Auckland.',
    url: 'https://ev.church/blog',
    siteName: 'Ev Church',
    locale: 'en_NZ',
    type: 'website',
  },
  alternates: {
    canonical: 'https://ev.church/blog',
  },
}

const placeholderPosts = [
  {
    slug: 'finding-community-in-a-busy-city',
    title: 'Finding Community in a Busy City',
    excerpt: 'How connect groups are helping Aucklanders build real friendships in the midst of busy lives.',
    image: '/images/homepage/carousel-3c68ddf1.jpg',
    author: 'Ev Church Team',
    date: '12 March 2026',
    category: 'Community',
  },
  {
    slug: 'why-easter-matters',
    title: 'Why Easter Matters',
    excerpt: 'Easter is more than chocolate eggs and a long weekend. Here is why this season means so much to us.',
    image: '/images/homepage/carousel-70ac2785.jpg',
    author: 'Ev Church Team',
    date: '5 March 2026',
    category: 'Faith',
  },
  {
    slug: 'raising-resilient-kids',
    title: 'Raising Resilient Kids',
    excerpt: 'Practical insights on helping your children navigate challenges with confidence and faith.',
    image: '/images/homepage/carousel-79cef650.jpg',
    author: 'Ev Church Team',
    date: '26 February 2026',
    category: 'Family',
  },
  {
    slug: 'volunteers-making-a-difference',
    title: 'Volunteers Making a Difference',
    excerpt: 'Meet some of the incredible people who serve behind the scenes every Sunday at Ev Church.',
    image: '/images/homepage/carousel-c645786c.jpg',
    author: 'Ev Church Team',
    date: '18 February 2026',
    category: 'Stories',
  },
  {
    slug: 'what-to-expect-at-explaining-christianity',
    title: 'What to Expect at Explaining Christianity',
    excerpt: 'Curious about faith? Here is what happens when you join our relaxed course exploring the basics.',
    image: '/images/homepage/carousel-9a8d8943.jpg',
    author: 'Ev Church Team',
    date: '10 February 2026',
    category: 'Faith',
  },
  {
    slug: 'summer-camp-recap',
    title: 'Summer Camp Recap',
    excerpt: 'A look back at an incredible summer camp filled with adventure, laughter, and life-changing moments.',
    image: '/images/homepage/carousel-c842f7b4.jpg',
    author: 'Ev Church Team',
    date: '2 February 2026',
    category: 'Events',
  },
]

export default function BlogPage() {
  return (
    <>
      {/* Header */}
      <section className="bg-warm-white px-5 pb-16 pt-24 lg:px-8 lg:pb-20 lg:pt-32">
        <div className="mx-auto max-w-[80rem]">
          <ScrollReveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rich-red">
              Stories and reflections
            </p>
            <h1 className="mt-3 text-display leading-display text-brand-black">
              Blog
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-body-lg text-dark-grey">
              Thoughts on faith, community, and life at Ev Church.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Blog Grid */}
      <section className="bg-warm-white px-5 pb-24 lg:px-8 lg:pb-32">
        <div className="mx-auto max-w-[80rem]">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {placeholderPosts.map((post, i) => (
              <ScrollReveal key={post.slug} delay={i * 80}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block overflow-hidden rounded-xl border border-warm-grey/60 bg-white transition-all duration-300 hover:border-rich-red/20 hover:shadow-lg hover:shadow-rich-red/5"
                >
                  <div className="aspect-[16/10] overflow-hidden">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-6">
                    <span className="text-xs font-semibold uppercase tracking-[0.15em] text-rich-red">
                      {post.category}
                    </span>
                    <h2 className="mt-2 text-h4 leading-snug text-brand-black transition-colors group-hover:text-rich-red">
                      {post.title}
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-mid-grey">
                      {post.excerpt}
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-xs text-mid-grey">
                      <span>{post.author}</span>
                      <span className="text-warm-grey">|</span>
                      <span>{post.date}</span>
                    </div>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>

          {/* Pagination Placeholder */}
          <ScrollReveal>
            <div className="mt-16 flex items-center justify-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-rich-red text-sm font-semibold text-white">
                1
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-warm-grey/60 bg-white text-sm font-semibold text-mid-grey transition-colors hover:border-rich-red/20 hover:text-brand-black">
                2
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-warm-grey/60 bg-white text-sm font-semibold text-mid-grey transition-colors hover:border-rich-red/20 hover:text-brand-black">
                3
              </span>
              <span className="ml-1 text-sm text-mid-grey">...</span>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  )
}
