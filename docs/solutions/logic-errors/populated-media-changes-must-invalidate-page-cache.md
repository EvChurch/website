---
title: Populated media changes must invalidate page caches
date: 2026-08-17
category: logic-errors
module: Public content routes
problem_type: logic_error
component: rails_view
symptoms:
  - A replaced Payload image is saved but public pages continue showing the previous file
  - Fresh homepage requests remain Next.js cache hits with the old populated media relationship
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [payload-cms, nextjs, cache-invalidation, media, public-routes]
---

# Populated media changes must invalidate page caches

## Problem

The homepage cached a populated Payload Page record for 24 hours. Replacing the referenced Media record updated the production media API, but the public page continued rendering the filename embedded in its older cached relationship.

## Symptoms

- The production Pages API returned the replacement image.
- The live homepage HTML and Next.js image URL still referenced the previous file.
- Repeated fresh requests returned `x-nextjs-cache: HIT`.

## What Didn't Work

- Reloading the browser did not help because the stale value was in the server-side page-data cache.
- The Page collection's `afterChange` hook did not run because the editor changed the related Media record rather than the Page record itself.

## Solution

Invalidate the cache tag consumed by populated page queries from the Media collection's update lifecycle:

```ts
hooks: {
  afterChange: [
    generateBlurPlaceholder,
    createCacheInvalidationHook(CACHE_TAGS.pages),
  ],
},
```

Extend the shared cache-hook test so it invokes the Media hook and verifies `revalidateTag(CACHE_TAGS.pages, { expire: 0 })`.

## Why This Works

The page cache stores the populated Media object, not only its relationship ID. A Media replacement can therefore change page output without changing the Page document. Invalidating the `pages` tag at the Media boundary forces the next page render to populate the relationship again.

## Prevention

- When caching populated Payload relationships, include each related collection in the invalidation map.
- Test cache-hook wiring at the collection boundary that editors actually modify.
- After deployment, verify both the source API record and the live page's delivered asset URL.

## Related Issues

- [A Payload collection does not connect its public route](payload-collection-does-not-connect-public-route.md)
