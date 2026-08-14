---
title: Next.js Open Graph overrides must repeat shared fallback fields
date: 2026-08-14
category: best-practices
module: public website SEO
problem_type: best_practice
component: documentation
severity: medium
applies_when:
  - A Next.js App Router page or layout defines a nested metadata object such as openGraph.
  - Every public route must emit a complete Open Graph image while preserving page-specific artwork.
tags:
  - next-js-16
  - metadata
  - open-graph
  - seo
  - ahrefs
---

# Next.js Open Graph overrides must repeat shared fallback fields

## Context

The frontend layout defined a complete `openGraph` object with a default image. Many child pages also defined `openGraph` to customize the title, description, or URL. Next.js shallowly merges metadata between route segments, so a child's nested `openGraph` object replaces the parent's object instead of inheriting omitted fields. Pages that did not repeat `images` therefore emitted incomplete Open Graph metadata even though the root layout supplied an image.

## Guidance

Keep the fallback descriptor in one shared constant and include it in every page-level `openGraph` object that does not provide specific artwork:

```ts
export const DEFAULT_OPEN_GRAPH_IMAGES = [
  {
    url: '/og-image',
    width: 1200,
    height: 630,
    alt: 'Ev Church — a community of Christ-followers across Auckland',
  },
]

export const metadata: Metadata = {
  openGraph: {
    title: 'Events at Ev Church',
    description: 'Find upcoming events across Ev Church.',
    url: 'https://www.ev.church/events',
    images: DEFAULT_OPEN_GRAPH_IMAGES,
  },
}
```

When a page has specific artwork, prefer it and fall back only when the media URL is unavailable. Serve the shared fallback from a stable route such as `/og-image`, and test both the metadata descriptor and the route response. Keep canonical URLs and `openGraph.url` aligned in the same metadata function.

## Why This Matters

Root metadata can look complete during code review while the rendered child route silently loses nested fields. Repeating the shared fallback at each override boundary prevents site-wide `og:image` gaps without replacing page-specific images.

## When to Apply

- A route adds or changes `openGraph`, `robots`, or another nested Next.js metadata field.
- A shared layout supplies defaults that child routes are expected to retain.
- An SEO crawler reports missing tags on pages whose root layout appears complete.

## Examples

For dynamic pages, select the specific image first:

```ts
images: imageUrl ? [{ url: imageUrl }] : DEFAULT_OPEN_GRAPH_IMAGES
```

Verify the emitted HTML for representative static and dynamic routes. Do not treat the presence of defaults in the root layout as proof that child routes inherit them.

## Related

- `src/lib/seo-metadata.ts`
- `src/app/(frontend)/layout.tsx`
- `src/app/(frontend)/og-image/route.ts`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`
