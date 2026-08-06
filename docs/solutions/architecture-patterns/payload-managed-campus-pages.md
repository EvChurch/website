---
title: Payload-managed campus pages with Rock-synced identity
date: 2026-08-06
last_updated: 2026-08-06
category: architecture-patterns
module: campus pages
problem_type: architecture_pattern
component: database
severity: medium
applies_when:
  - Campus identity is synchronized from Rock RMS but website content must remain editorially managed.
  - Shared page sections need campus-specific filtering without duplicating page templates.
tags:
  - payload
  - campuses
  - rock-rms
  - migrations
  - content-blocks
---

# Payload-managed campus pages with Rock-synced identity

## Context

Campus landing pages previously kept campus-specific copy, imagery, service details, and SEO exceptions in the dynamic Next.js route. Rock RMS still owns the campus records, while Payload needs to own the website presentation without allowing a normal Rock sync to erase editorial content.

## Guidance

Keep synchronized identity fields and editorial page fields in the same Payload collection, but in separate field groups. The Rock mapper should update only fields sourced from Rock. The `Campuses` collection stores website content under `pageContent` and reusable sections under `layout` in `src/collections/Campuses.ts`.

The public route in `src/app/(frontend)/campus/[slug]/page.tsx` should:

- Query a campus by its synchronized slug.
- Select only the fields required to render the page.
- Require `pageContent.enabled` and complete required editorial values before publishing.
- Prefer uploaded Payload media, with migrated public image paths as fallbacks.
- Render `layout` through the shared block renderer.
- Keep campus-specific SEO in Payload rather than branching on a slug.

Use an additive Payload migration for the schema and backfill. Preserve existing synchronized or editorial values with `COALESCE`, enable only known public campuses, and seed an `upcomingEvents` block whose campus relationship points back to the owning campus.

For managed map links, store a canonical HTTPS Google Maps place URL and turn it into an embed URL at render time. Prefer a stable `place_id` target over a free-text address query so venues inside a larger site, such as Old Government House, resolve to the intended building. Do not iframe the normal `/maps/place/` page because Google serves it with `X-Frame-Options: SAMEORIGIN`. When `GOOGLE_MAPS_API_KEY` is configured, extract the trusted `place_id` query and use Google's official `/maps/embed/v1/place` endpoint. The legacy `/maps?q=place_id:...&output=embed` form can render an unpinned world map, so without a key fall back to a URL-encoded query built from the managed campus address. Validate the protocol, host, and `/maps` path before deriving either iframe URL.

Use migrations for schema changes and one-time production data transitions. When a deployment re-applies the canonical seed, fold durable content defaults and corrections back into an idempotent seed helper instead of adding another content-only migration. Query only the owned fields, skip unchanged records, and treat Payload's nested field defaults as uninitialized state. Preserve populated editorial groups even when `pageContent.enabled` is deliberately false. Replace a historical seeded value only when it matches that campus's exact legacy value, so a later editor-selected location is not overwritten.

## Why This Matters

This boundary lets Rock remain the operational source for campus identity while content editors control the public page in Payload. It also keeps one shared page template and one reusable events component, avoiding route-level copies that drift apart.

## When to Apply

- A Rock-synced collection also needs website-only copy, media, SEO, or layout.
- Several campus pages share a design but need distinct content.
- A reusable block must automatically filter itself to the campus that owns the page.

## Examples

For a campus page, set `pageContent.enabled`, complete its editorial fields, upload `featuredImage` or `slideImages` when available, and add an `upcomingEvents` block to `layout` with the campus filter set to that campus. Unknown or incomplete synchronized campuses remain unpublished instead of rendering partial pages.

Verify the pattern with route tests, migration integration tests, the full test suite, a production build, and browser checks for each managed campus at desktop and mobile widths.

## Related

- `src/migrations/20260805_234700_campus_managed_pages.ts`
- `src/migrations/20260806_103317_exact_campus_map_locations.ts`
- `src/seed/campus-pages.ts`
- `src/lib/google-maps.ts`
- `src/blocks/UpcomingEventsBlock.ts`
- `src/components/blocks/UpcomingEventsBlockComponent.tsx`
