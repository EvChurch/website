---
title: A Payload collection does not connect its public route
date: 2026-08-13
category: logic-errors
module: Public content routes
problem_type: logic_error
component: rails_view
symptoms:
  - Public pages show hard-coded placeholder records even though the corresponding Payload collection exists
  - Detail routes derive titles from arbitrary URL slugs and render the same placeholder body for every slug
root_cause: logic_error
resolution_type: code_fix
severity: critical
tags: [payload-cms, nextjs, public-routes, rich-text, production-content]
---

# A Payload collection does not connect its public route

## Problem

The public blog routes rendered hard-coded cards and Lorem Ipsum even though the repository already defined a complete Payload `blog-posts` collection. A configured collection, generated database schema, and sitemap query did not mean the visible route used CMS data.

## Symptoms

- `src/app/(frontend)/blog/page.tsx` contained a local placeholder array instead of a Payload query.
- `src/app/(frontend)/blog/[slug]/page.tsx` converted any slug into a title and returned one fixed article body.
- The detail route did not return 404 for an unknown or unpublished slug.

## What Didn't Work

- Treating the presence of `src/collections/BlogPosts.ts` as evidence that the public route was CMS-backed. Collection registration only creates the authoring and data boundary.
- Treating a passing build as content-path verification. Static placeholder components type-check and build successfully.

## Solution

Create a shared public-data boundary that queries only published records and selects only the fields each route needs:

```ts
const result = await payload.find({
  collection: 'blog-posts',
  where: { _status: { equals: 'published' } },
  sort: '-publishedDate',
  depth: 1,
  select: {
    title: true,
    slug: true,
    author: true,
    publishedDate: true,
    featuredImage: true,
    excerpt: true,
  },
})
```

The detail query also filters by slug and published status. The route calls `notFound()` when that query returns no record. Metadata, hero media, author, date, excerpt, rich text, and disclosure all use the resolved Payload record.

Cache public queries with `CACHE_TAGS.blogPosts`, and invalidate that tag from the `blog-posts` collection's `afterChange` and `afterDelete` hooks. Payload rich text needs representative rendering tests for embedded uploads and internal links; otherwise unknown Lexical nodes can disappear while ordinary paragraphs still look correct.

## Why This Works

The public route and Payload authoring model now share one explicit query contract. Draft filtering happens at the data boundary, field projections prevent listing requests from loading complete article bodies, and cache invalidation makes CMS edits visible without querying PostgreSQL on every render.

Tests assert both the query contract and rendered page output, so the route cannot silently fall back to placeholder text while remaining build-green.

## Prevention

- For every CMS-managed collection, trace the actual public route to a `payload.find` call before calling the integration complete.
- Add rendered route tests that use recognizable CMS fixture values and explicitly reject known placeholder copy.
- Test missing records, drafts, missing media, and rich-text node types used by editors.
- Verify the live route after deployment; a local build proves compilation, not the production database, content, or deployment revision.

## Related Issues

- [Phase 3 Payload collections, blocks, and globals](../integration-issues/phase3-payload-collections-blocks-globals.md)
- [Phases 3-8 full build completion](../integration-issues/phases3-8-full-build-completion.md)
