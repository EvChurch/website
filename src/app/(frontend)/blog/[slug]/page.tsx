import type { Metadata } from 'next'
import Link from 'next/link'
import { ScrollReveal } from '@/components/ui/ScrollReveal'

type Props = {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

export async function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const title = slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return {
    title: `${title} | Ev Church Blog`,
    description: `Read "${title}" on the Ev Church Auckland blog. Stories of faith, community, and life in Tamaki Makaurau.`,
    openGraph: {
      title: `${title} | Ev Church Blog`,
      description: `Read "${title}" on the Ev Church blog.`,
      url: `https://www.ev.church/blog/${slug}`,
      siteName: 'Ev Church',
      locale: 'en_NZ',
      type: 'article',
    },
    alternates: {
      canonical: `https://www.ev.church/blog/${slug}`,
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const title = slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-[50vh] items-end overflow-hidden bg-brand-black">
        <div className="absolute inset-0">
          <img
            src="/images/homepage/carousel-c645786c.jpg"
            alt={title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-black/90 via-brand-black/50 to-brand-black/20" />
        </div>

        <div className="relative mx-auto w-full max-w-[80rem] px-5 pb-16 pt-40 lg:px-8 lg:pb-20">
          <div className="mx-auto max-w-3xl">
            <p
              className="animate-fade-in-up text-xs font-semibold uppercase tracking-[0.2em] text-light-red-2"
              style={{ animationDelay: '100ms' }}
            >
              Blog
            </p>
            <h1
              className="animate-fade-in-up mt-4 text-h1 leading-display text-white lg:text-display"
              style={{ animationDelay: '200ms' }}
            >
              {title}
            </h1>
            <div
              className="animate-fade-in-up mt-6 flex items-center gap-3 text-sm text-warm-grey/70"
              style={{ animationDelay: '350ms' }}
            >
              <span className="font-semibold text-warm-grey/90">Ev Church Team</span>
              <span>|</span>
              <time>12 March 2026</time>
            </div>
          </div>
        </div>
      </section>

      {/* Article Content */}
      <section className="bg-warm-white px-5 py-20 lg:px-8 lg:py-28">
        <article className="mx-auto max-w-3xl">
          <ScrollReveal>
            <div className="space-y-6 text-[0.9375rem] leading-relaxed text-dark-grey">
              <p className="text-lg leading-body-lg text-brand-black">
                This is a placeholder for blog post content. When connected to
                Payload CMS, this page will display the full rich text content
                of each blog post, complete with images, headings, block quotes,
                and other formatted elements.
              </p>

              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
                enim ad minim veniam, quis nostrud exercitation ullamco laboris
                nisi ut aliquip ex ea commodo consequat.
              </p>

              <h2 className="text-h3 text-brand-black pt-4">
                A section heading
              </h2>

              <p>
                Duis aute irure dolor in reprehenderit in voluptate velit esse
                cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat
                cupidatat non proident, sunt in culpa qui officia deserunt mollit
                anim id est laborum.
              </p>

              <blockquote className="border-l-4 border-rich-red/30 pl-6 italic text-brand-black">
                &ldquo;Faith is taking the first step even when you do not see
                the whole staircase.&rdquo;
              </blockquote>

              <p>
                Sed ut perspiciatis unde omnis iste natus error sit voluptatem
                accusantium doloremque laudantium, totam rem aperiam, eaque ipsa
                quae ab illo inventore veritatis et quasi architecto beatae vitae
                dicta sunt explicabo.
              </p>

              <h2 className="text-h3 text-brand-black pt-4">
                Another section
              </h2>

              <p>
                Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit
                aut fugit, sed quia consequuntur magni dolores eos qui ratione
                voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem
                ipsum quia dolor sit amet.
              </p>

              <p>
                At vero eos et accusamus et iusto odio dignissimos ducimus qui
                blanditiis praesentium voluptatum deleniti atque corrupti quos
                dolores et quas molestias excepturi sint occaecati cupiditate non
                provident.
              </p>
            </div>
          </ScrollReveal>

          {/* Back link */}
          <ScrollReveal>
            <div className="mt-16 border-t border-warm-grey/60 pt-8">
              <Link
                href="/blog"
                className="group inline-flex items-center gap-2 text-sm font-semibold text-rich-red transition-colors hover:text-deep-red"
              >
                <svg
                  className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Back to all posts
              </Link>
            </div>
          </ScrollReveal>
        </article>
      </section>
    </>
  )
}
