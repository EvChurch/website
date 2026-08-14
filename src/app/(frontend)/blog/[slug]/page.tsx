import type { Metadata } from 'next'
import Link from 'next/link'

import RichText from '@/components/blocks/RichTextRenderer'
import { MediaImage } from '@/components/media/MediaImage'
import { getPayloadMediaUrl } from '@/lib/payload-media'
import { DEFAULT_OPEN_GRAPH_IMAGES } from '@/lib/seo-metadata'
import { trackedNotFound } from '@/lib/tracked-not-found'
import { ScrollReveal } from '@/components/ui/ScrollReveal'
import {
  formatBlogDate,
  getBlogDescription,
  getBlogImage,
  getBlogPostBySlug,
} from '@/lib/blog'

type Props = {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getBlogPostBySlug(slug)
  if (!post) return {}

  const title = post.seo?.metaTitle?.trim() || `${post.title} | Ev Church Blog`
  const description = getBlogDescription(post)
  const image = getBlogImage(post)
  const imageUrl = image ? getPayloadMediaUrl(image, 'large') : null
  const url = `https://www.ev.church/blog/${post.slug}`

  return {
    title: post.seo?.metaTitle ? { absolute: title } : title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'Ev Church',
      locale: 'en_NZ',
      type: 'article',
      publishedTime: post.publishedDate,
      authors: [post.author],
      images: imageUrl
        ? [{ url: imageUrl, alt: image?.alt || post.title }]
        : DEFAULT_OPEN_GRAPH_IMAGES,
    },
    alternates: { canonical: url },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = await getBlogPostBySlug(slug)
  if (!post) trackedNotFound('blog', slug)

  const image = getBlogImage(post)

  return (
    <>
      <section className="relative flex min-h-[50vh] items-end overflow-hidden bg-brand-black">
        {image?.url && (
          <div className="absolute inset-0">
            <MediaImage
              media={image}
              mediaSize="hero"
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-black/95 via-brand-black/55 to-brand-black/25" />
          </div>
        )}

        <div className="relative mx-auto w-full max-w-[80rem] px-5 pb-16 pt-40 lg:px-8 lg:pb-20">
          <div className="mx-auto max-w-3xl">
            <p className="animate-fade-in-up text-xs font-semibold uppercase tracking-[0.2em] text-hero-eyebrow">
              Blog
            </p>
            <h1
              className="animate-fade-in-up mt-4 text-h1 leading-display text-white lg:text-display"
              style={{ animationDelay: '100ms' }}
            >
              {post.title}
            </h1>
            <div
              className="animate-fade-in-up mt-6 flex flex-wrap items-center gap-3 text-sm text-warm-grey/80"
              style={{ animationDelay: '200ms' }}
            >
              <span className="font-semibold text-warm-grey">{post.author}</span>
              <span aria-hidden="true">|</span>
              <time dateTime={post.publishedDate}>{formatBlogDate(post.publishedDate)}</time>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-warm-white px-5 py-20 lg:px-8 lg:py-28">
        <article className="mx-auto max-w-3xl">
          <ScrollReveal>
            {post.excerpt && (
              <p className="mb-10 text-xl leading-body-lg text-brand-black">{post.excerpt}</p>
            )}
            <div className="text-[1.0625rem] leading-[1.8] text-dark-grey [&_blockquote]:my-8 [&_blockquote]:border-l-4 [&_blockquote]:border-rich-red/30 [&_blockquote]:pl-6 [&_blockquote]:text-xl [&_blockquote]:italic [&_h2]:mb-4 [&_h2]:mt-12 [&_h2]:text-h3 [&_h2]:text-brand-black [&_h3]:mb-3 [&_h3]:mt-9 [&_h3]:text-h4 [&_h3]:text-brand-black [&_li]:mb-2 [&_ol]:my-6 [&_ol]:list-decimal [&_ol]:pl-7 [&_p]:mb-6 [&_ul]:my-6 [&_ul]:list-disc [&_ul]:pl-7">
              <RichText data={post.content} />
            </div>
            {post.isAiGenerated && post.aiDisclosure && (
              <p className="mt-12 border-l-2 border-warm-grey pl-4 text-sm italic text-mid-grey">
                {post.aiDisclosure}
              </p>
            )}
          </ScrollReveal>

          <ScrollReveal>
            <div className="mt-16 border-t border-warm-grey/60 pt-8">
              <Link
                href="/blog"
                className="group inline-flex items-center gap-2 text-sm font-semibold text-rich-red transition-colors hover:text-deep-red"
              >
                <span aria-hidden="true" className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
                Back to all posts
              </Link>
            </div>
          </ScrollReveal>
        </article>
      </section>
    </>
  )
}
