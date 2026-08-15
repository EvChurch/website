import { cache } from 'react'
import { unstable_cache } from 'next/cache'

import type { BlogPost } from '@/payload-types'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { getPayloadClient } from '@/lib/payload'

export type BlogPostListing = Pick<
  BlogPost,
  | 'id'
  | 'title'
  | 'slug'
  | 'author'
  | 'publishedDate'
  | 'featuredImage'
  | 'excerpt'
>

export type PublicBlogPost = BlogPostListing & Pick<
  BlogPost,
  | 'content'
  | 'isAiGenerated'
  | 'aiDisclosure'
  | 'seo'
>

async function fetchPublishedBlogPosts(): Promise<BlogPostListing[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'blog-posts',
    where: { _status: { equals: 'published' } },
    sort: '-publishedDate',
    depth: 1,
    limit: 1000,
    select: {
      title: true,
      slug: true,
      author: true,
      publishedDate: true,
      featuredImage: true,
      excerpt: true,
    },
  })

  return result.docs as BlogPostListing[]
}

async function fetchBlogPostBySlug(slug: string): Promise<PublicBlogPost | null> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'blog-posts',
    where: {
      and: [
        { slug: { equals: slug } },
        { _status: { equals: 'published' } },
      ],
    },
    depth: 1,
    limit: 1,
    select: {
      title: true,
      slug: true,
      author: true,
      publishedDate: true,
      featuredImage: true,
      content: true,
      excerpt: true,
      isAiGenerated: true,
      aiDisclosure: true,
      seo: true,
    },
  })

  return (result.docs[0] as PublicBlogPost | undefined) ?? null
}

export const getPublishedBlogPosts = unstable_cache(
  fetchPublishedBlogPosts,
  ['published-blog-posts'],
  { tags: [CACHE_TAGS.blogPosts], revalidate: 86_400 },
)

const getCachedBlogPostBySlug = unstable_cache(
  fetchBlogPostBySlug,
  ['published-blog-post-by-slug'],
  { tags: [CACHE_TAGS.blogPosts], revalidate: 86_400 },
)

export const getBlogPostBySlug = cache(getCachedBlogPostBySlug)

export function getBlogImage(post: Pick<BlogPost, 'featuredImage'>) {
  return post.featuredImage && typeof post.featuredImage === 'object'
    ? post.featuredImage
    : null
}

export function formatBlogDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Pacific/Auckland',
  })
}

export function blogContentToPlainText(value: unknown): string {
  const text: string[] = []

  function visit(node: unknown): void {
    if (!node || typeof node !== 'object') return
    const record = node as Record<string, unknown>
    if (typeof record.text === 'string') text.push(record.text)
    if (Array.isArray(record.children)) record.children.forEach(visit)
    if (record.root) visit(record.root)
  }

  visit(value)
  return text.join(' ').replace(/\s+/g, ' ').trim()
}

export function getBlogDescription(post: PublicBlogPost): string {
  return (
    post.seo?.metaDescription?.trim() ||
    post.excerpt?.trim() ||
    blogContentToPlainText(post.content).slice(0, 155) ||
    `Read ${post.title} on the Ev Church blog.`
  )
}
