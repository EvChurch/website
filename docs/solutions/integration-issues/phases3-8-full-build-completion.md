---
title: "ev.church Full Build: Phases 3-8 Payload Collections, Rock Sync, Pages, and Features"
category: integration-issues
date: 2026-03-22
tags:
  - payload-cms-3
  - next-js-16
  - rock-rms
  - sync
  - collections
  - blocks
  - forms
  - seo
  - analytics
severity: info
component:
  - src/collections/
  - src/blocks/
  - src/globals/
  - src/sync/
  - src/app/(frontend)/
  - src/components/
problem_type:
  - feature-build
---

# ev.church Full Build: Phases 3-8

This document covers the complete build of the ev.church website from Payload CMS collections through to production-ready pages, Rock RMS synchronisation, forms, SEO, and analytics.

---

## Phase 3: Payload Collections, Blocks, and Globals

### Overview

Phase 3 established the data layer: 11 collections, 7 block types, and 2 globals, all authored in TypeScript with strict mode.

### Collections (11 total)

**Synced from Rock RMS (6):**

| Collection | Slug | Rock Entity | Key Fields |
|---|---|---|---|
| Campuses | `campuses` | Campus | `rockId`, name, slug, location, serviceTimes |
| Team Members | `team-members` | Person/GroupMember | `rockPersonId`, name, role, photo, order |
| Events | `events` | EventItemOccurrence | `rockEventId`, title, date, campus, location |
| Sermon Series | `sermon-series` | ContentChannelItem | `rockContentItemId`, title, content, startDate |
| Connect Groups | `connect-groups` | Group | `rockGroupId`, name, description, campus, capacity |
| Registrations | `registrations` | RegistrationInstance | `rockRegistrationId`, name, dates, maxAttendees |

**Content collections (3):**

| Collection | Slug | Purpose |
|---|---|---|
| Pages | `pages` | CMS-managed pages with block-based `layout` field and SEO group |
| Blog Posts | `blog-posts` | Long-form content with drafts and publish workflow |
| Announcements | `announcements` | Time-bound banners with `startDate`/`endDate` and color presets |

**System collections (2):**

| Collection | Slug | Purpose |
|---|---|---|
| Users | `users` | Auth collection with `roles` field (admin, content-lead, editor) |
| Media | `media` | Image/file uploads destined for S3-compatible storage |

### Block Types (7)

All blocks follow the convention: slug in camelCase, `interfaceName` set for predictable generated types.

| Block | Slug | Key Fields |
|---|---|---|
| Hero | `hero` | image (upload), heading, subtitle, buttons array (max 2, with variant) |
| Content | `content` | richText (Lexical), alignment |
| CTA | `cta` | heading, body, buttons, background color preset |
| Card Grid | `cardGrid` | cards array with image, title, description, link |
| Accordion | `accordion` | items array with question/answer pairs |
| Image Gallery | `imageGallery` | images array (upload), columns, caption |
| Video | `video` | source URL, poster image, autoplay toggle |

Blocks are composed into the Pages collection via a `layout` field of type `blocks`.

### Globals (2)

| Global | Slug | Purpose |
|---|---|---|
| Navigation | `navigation` | `mainNav` (with nested children for dropdowns) and `footerNav` (grouped by title) |
| Site Settings | `site-settings` | Site-wide configuration (logo, social links, default SEO) |

### Access Control

Reusable access helpers in `src/access/roles.ts`:

- **`isAdmin`** -- Full access, checks `roles.includes('admin')`
- **`isContentLead`** -- Admin or content-lead role
- **`isEditor`** -- Any authenticated user
- **`publishedOnly`** -- Authenticated users see all; anonymous users see only `_status: published`

Synced collections enforce read-only for non-admin users. The Pages collection uses `publishedOnly` for read, `isContentLead` for create/delete, and `isEditor` for update.

### Key Decision: Type Regeneration

Payload CMS 3.x generates TypeScript types from collection/block/global configs into `src/payload-types.ts` (gitignored). After adding all 11 collections and 7 blocks, running `payload generate:types` is mandatory before any code that imports those types can compile. This file must be regenerated after every schema change. The build pipeline runs generation automatically, but local development requires manual runs or the `--watch` flag.

### Template System

The Pages collection includes a `template` field with four options:
- `standard` -- General-purpose layout
- `ministry` -- Ministry landing pages (Kids, Youth, Connect Groups)
- `seasonal-event` -- Time-limited campaigns (Easter, Christmas)
- `simple-content` -- Text-heavy pages (Privacy, Terms)

---

## Phase 4: Rock RMS Synchronisation

### Rock API Client

Location: `src/lib/rock-api.ts`

The client centralises all Rock RMS API communication with:

- **Authentication** via `Authorization-Token` header using `ROCK_API_KEY` env var
- **Exponential backoff retry** -- 3 retries with 1s/2s/4s delays
- **Custom error class** (`RockAPIError`) capturing HTTP status and endpoint for debugging
- **Image download** via `rockFetchImage()` for importing Rock-hosted photos
- **Explicit TypeScript interfaces** for every Rock entity type -- no `any` permitted per project conventions

Typed Rock API response interfaces:
- `RockCampus` (with nested Location and AttributeValues)
- `RockPerson`, `RockGroupMember`
- `RockEventItemOccurrence` (with nested EventItem, Schedule)
- `RockContentChannelItem` (sermon series via ContentChannelId filter)
- `RockGroup` (with Members, GroupLocations)
- `RockRegistrationInstance`

### Entity Mappers

Five mappers in `src/sync/mappers/` transform Rock API shapes into Payload collection schemas:

| Mapper | File | Rock Source | Payload Target |
|---|---|---|---|
| Campus | `campus.ts` | `RockCampus` | `campuses` |
| Team Member | `team-member.ts` | `RockGroupMember` | `team-members` |
| Event | `event.ts` | `RockEventItemOccurrence` | `events` |
| Sermon Series | `sermon-series.ts` | `RockContentChannelItem` | `sermon-series` |
| Connect Group | `connect-group.ts` | `RockGroup` | `connect-groups` |

Each mapper is a pure function that receives the Rock type and returns a plain object matching the Payload collection fields. No database calls inside mappers -- they are purely transformational.

### Sync Runner

Location: `src/sync/sync-runner.ts`

`runFullSync()` performs a full reconciliation for all 5 synced entity types sequentially. For each entity:

1. Fetch all records from Rock RMS API with appropriate OData filters
2. Map each record through its entity mapper
3. Find existing Payload doc by `rockId`/`rockPersonId`/`rockEventId`/etc. (using `depth: 0`, `limit: 1`)
4. Create or update accordingly
5. Return a `SyncResult` with counts: `{ entity, created, updated, deleted, errors }`

After each entity type sync, `revalidateTag()` is called to bust ISR caches.

### Webhook Endpoint

Location: `src/app/api/webhooks/rock-rms/route.ts`

Receives POST requests from Rock RMS when entities change. Flow:

1. Validate `x-rock-webhook-secret` header against `ROCK_WEBHOOK_SECRET` env var
2. Parse `RockWebhookPayload` (entityType, entityId, operation, timestamp)
3. Map Rock entity type to Payload cache tag via `ENTITY_TO_CACHE_TAG` lookup
4. Call `revalidateTag()` so the next page render fetches fresh data
5. Return JSON response with revalidation status

### Cron Sync Trigger

Location: `src/app/api/sync/trigger/route.ts`

An API route designed to be called by an external cron service (e.g., Railway cron or GitHub Actions) every 15 minutes. Invokes `runFullSync()` and returns aggregated results.

### Key Issue: revalidateTag in Next.js 16

In Next.js 15+, `revalidateTag()` requires a second `profile` argument. The codebase uses:

```typescript
revalidateTag(CACHE_TAGS.campuses, 'default')
```

The second argument `'default'` specifies the cache profile. Omitting it causes a TypeScript error in strict mode with Next.js 16 types. This is a breaking change from Next.js 14 where `revalidateTag` accepted only one argument.

### Cache Tag Strategy

Location: `src/lib/cache-tags.ts`

A centralised constant object maps logical entity names to string cache tags. All ISR caches (`unstable_cache`) and revalidation calls reference these constants, preventing tag typos and enabling find-all-references in the IDE.

```typescript
export const CACHE_TAGS = {
  campuses: 'campuses',
  events: 'events',
  teamMembers: 'team-members',
  sermonSeries: 'sermon-series',
  connectGroups: 'connect-groups',
  registrations: 'registrations',
  pages: 'pages',
  blogPosts: 'blog-posts',
  announcements: 'announcements',
  navigation: 'navigation',
  siteSettings: 'site-settings',
} as const
```

---

## Phases 5-6: Frontend Pages and Components

### Page Routes (17 total)

All pages live under `src/app/(frontend)/` using a route group for the public-facing layout (Header, Footer, AnnouncementBanner, GoogleAnalytics).

**Static pages (14):**

| Route | Path | Category |
|---|---|---|
| Home | `/` | Landing |
| About | `/about` | Information |
| Visit | `/visit` | Campus info |
| Vision | `/vision` | Leadership/mission |
| Contact | `/contact` | Form-based |
| Kids | `/kids` | Ministry |
| Youth | `/youth` | Ministry |
| Newish | `/newish` | Onboarding |
| Explaining Christianity | `/explaining-christianity` | Ministry |
| Connect Groups | `/connect-groups` | Community |
| Easter | `/easter` | Seasonal event |
| Holy Spirit | `/hs` | Teaching content |
| Blog Index | `/blog` | Content listing |
| Privacy | `/privacy` | Legal/compliance |

**Dynamic pages (3):**

| Route | Path | Data Source |
|---|---|---|
| Campus Detail | `/campus/[slug]` | Campuses collection |
| Blog Post | `/blog/[slug]` | Blog Posts collection |
| CMS Pages | (via Pages collection) | Pages collection `layout` blocks |

### Layout Architecture

The frontend layout (`src/app/(frontend)/layout.tsx`) composes:

1. **Adobe Fonts preconnect** -- `<link rel="preconnect">` and `<link rel="dns-prefetch">` for `use.typekit.net`
2. **OrganizationJsonLd** -- Structured data for Google's knowledge panel
3. **GoogleAnalytics** -- Client component, conditionally rendered when `NEXT_PUBLIC_GA_ID` is set
4. **AnnouncementBanner** -- Server component fetching active announcements via `unstable_cache`
5. **Header** -- Site navigation
6. **Main content** -- `{children}`
7. **Footer** -- Footer navigation and social links

### SEO Metadata

The root layout exports comprehensive `Metadata` and `Viewport` objects:

- `metadataBase` from `NEXT_PUBLIC_SITE_URL` env var
- Title template: `%s | Ev Church`
- Open Graph with `en_NZ` locale
- Twitter card: `summary_large_image`
- Theme color: `#E22A30` (Rich Red)
- Robot directives: index and follow enabled

Individual pages can override via the `seo` group on the Pages collection (metaTitle, metaDescription, ogImage).

### Design System and Styling

All pages follow consistent design principles:

- **Typography pairing**: Proxima Nova (primary sans-serif) for body text and UI, Utopia (secondary serif) for editorial headings
- **Brand palette**: Rich Red `#E22A30`, Brand Black `#0F0004`, Warm White `#FEFAF4`
- **Container**: `max-w-[80rem]` (1280px) with responsive padding
- **Scroll animations**: `ScrollReveal` component (`src/components/ui/ScrollReveal.tsx`) for fade-in-on-scroll effects
- **Community photography**: Real photos from church life rather than stock imagery, delivered through the Media collection and S3 storage

### Component Architecture

Components follow the `'use client'` boundary principle:

- **Server Components** (default): All page-level components, data-fetching components, layout components (Header, Footer, AnnouncementBanner)
- **Client Components** (`'use client'`): Only interactive leaf components -- ContactForm, SignupForm, ScrollReveal, GoogleAnalytics

Block rendering uses `RenderBlocks` (`src/components/blocks/RenderBlocks.tsx`) with a block-type-to-component map validated with `satisfies` for exhaustiveness checking.

### Rich Text

Lexical rich text from Payload is rendered via `RichTextRenderer` (`src/components/blocks/RichTextRenderer.tsx`), handling the Lexical JSON serialisation format used by `@payloadcms/richtext-lexical`.

---

## Phases 7-8: Forms, SEO Infrastructure, and Analytics

### Forms

**Contact Form** (`src/components/forms/ContactForm.tsx`):
- Client component with `useState` for form status tracking (`idle` | `submitting` | `success` | `error`)
- Fields: name (required), email (required), campus (select: North/Central/Unichurch), message (required)
- Submits to `/api/forms/contact` as JSON POST
- Error handling with user-facing messages
- Success state replaces the form with a confirmation message
- Styled with Tailwind utilities matching the brand design system

**Signup Form** (`src/components/forms/SignupForm.tsx`):
- Similar architecture to ContactForm
- Submits to `/api/forms/signup`

**API Routes**:
- `src/app/api/forms/contact/route.ts` -- Handles contact form submissions
- `src/app/api/forms/signup/route.ts` -- Handles signup form submissions

### Announcement Banner

`src/components/layout/AnnouncementBanner.tsx` is a Server Component that:

1. Queries the `announcements` collection for active announcements (where `startDate <= now <= endDate` and `_status: published`)
2. Caches the result with `unstable_cache` using the `announcements` cache tag and 300-second revalidation
3. Renders a banner with three color presets: `primary-red` (Rich Red background), `light` (Warm White), `dark` (Brand Black)
4. Supports an optional link with label and href
5. Returns `null` when no active announcements exist -- zero layout shift

### Sitemap

Location: `src/app/sitemap.ts`

Generates a dynamic `sitemap.xml` using Next.js Metadata API:

- **Static routes** (11): Home, About, Visit, Vision, Contact, Next Steps, Explaining Christianity, Newish, Connect Groups, Kids, Youth -- each with appropriate `changeFrequency` and `priority`
- **Dynamic campus routes**: Queried from Payload `campuses` collection with `depth: 0` and `select: { slug, updatedAt }`
- **Dynamic blog routes**: Queried from Payload `blog-posts` collection, filtered to published only, limit 1000

### robots.txt

Location: `src/app/robots.ts`

Programmatic `robots.txt` via Next.js Metadata API:

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Sitemap: https://ev.church/sitemap.xml
```

Blocks the Payload admin panel (`/admin/`) and API routes (`/api/`) from search engine indexing while allowing all public pages.

### Google Analytics

Location: `src/components/seo/GoogleAnalytics.tsx`

- Client component using `next/script` with `afterInteractive` strategy
- Conditionally rendered: returns `null` when `NEXT_PUBLIC_GA_ID` is not set
- Standard gtag.js implementation with `dataLayer` initialisation

### Structured Data

Location: `src/components/seo/OrganizationJsonLd.tsx`

Renders `<script type="application/ld+json">` in the document head with Organization schema for Google's knowledge panel.

---

## Prevention Strategies

### Type Safety

1. **Always regenerate types after schema changes.** Run `payload generate:types` after adding or modifying any collection, block, or global. The CI pipeline should include type generation as a build step before `tsc --noEmit`.

2. **Never use `any` for Rock API responses.** Every Rock RMS entity has an explicit TypeScript interface in `src/lib/rock-api.ts`. When Rock adds new fields, extend the interface -- do not fall back to `any`.

3. **Use `satisfies` for block renderer maps.** The `RenderBlocks` component should use a `Record<BlockType, ComponentType>` validated with `satisfies` so that adding a new block without a renderer is a compile-time error.

### Data Fetching

4. **Always pass `depth: 0` or `depth: 1` on Payload Local API calls.** Uncontrolled depth causes recursive relationship loading that can return megabytes of data and cause timeouts.

5. **Use `select` to return only needed fields.** The sitemap demonstrates this: `select: { slug: true, updatedAt: true }` instead of returning full documents.

6. **Cache with tags, not time alone.** Use `unstable_cache` with `revalidateTag` for ISR. The `CACHE_TAGS` constant ensures tag consistency across the codebase.

### Sync Reliability

7. **Idempotent upserts.** The sync runner looks up existing docs by Rock ID before deciding to create or update. This means re-running sync is always safe -- no duplicates.

8. **Sequential entity sync.** The `runFullSync()` function syncs entity types one at a time. This prevents overwhelming the Rock API or PostgreSQL with concurrent writes and makes error isolation straightforward.

9. **Webhook validation.** Always validate the `x-rock-webhook-secret` header. Log a warning (not an error) when the secret is unset during development, but require it in production.

### Frontend

10. **`params` and `searchParams` are Promises in Next.js 15+.** Always `await` them in page components. Forgetting to await produces a `[object Promise]` string instead of the actual value.

11. **`'use client'` only on leaf components.** Forms, scroll observers, and analytics scripts need client-side JavaScript. Everything else -- pages, layouts, data-fetching wrappers -- stays as Server Components for optimal performance.

12. **Announcement banner must handle empty state.** Return `null` when no announcements are active to avoid rendering an empty coloured bar.

---

## Key Learnings

1. **`revalidateTag` signature changed in Next.js 16.** The function now requires a second `profile` argument (`'default'`). Every call site -- sync runner, webhook handler, and any future revalidation -- must include it.

2. **Payload CMS 3.x block `interfaceName` is essential.** Without it, generated type names are unpredictable (e.g., `Page_Layout_0` instead of `HeroBlock`). Set `interfaceName` on every block definition.

3. **Verify Rock RMS OData entity paths and enum representations against the deployed version.** In Rock v19.2, group membership is queried through `GroupMembers` with a numeric `GroupMemberStatus eq 1` filter; `Groups/{id}/Members` is not a valid OData path. Expand `Person,GroupRole` on the `GroupMembers` query instead of relying on nested member expansions from `Groups`.

4. **Entity mappers should be pure functions.** Keeping Rock-to-Payload transformation logic free of side effects (no database calls, no network requests) makes them trivially testable and predictable.

5. **Cache tag centralisation prevents silent bugs.** A typo in a cache tag string means `revalidateTag` silently does nothing -- the stale page is never refreshed. The `CACHE_TAGS` constant with `as const` assertion eliminates this risk.

6. **The sitemap must filter by `_status: published`.** Without this filter, draft blog posts appear in the sitemap and get indexed by search engines before they are ready.

7. **Form components need explicit status state machines.** The `idle | submitting | success | error` pattern prevents double-submissions, provides clear user feedback, and handles both network and validation errors gracefully.

8. **Google Analytics must be conditionally rendered.** Returning `null` when `NEXT_PUBLIC_GA_ID` is unset means development and preview environments do not send tracking data, and the analytics script is not loaded at all (not just disabled).

9. **Access control layering matters.** The combination of `publishedOnly` (collection-level read access) and role-based write access means the API itself enforces content visibility -- frontend code does not need to filter drafts manually.

10. **Webhook-driven revalidation is faster but cron sync is safer.** Webhooks provide near-instant cache busting but can be lost if the server is restarting. The 15-minute cron sync acts as a reconciliation safety net, ensuring data consistency even if webhooks are missed.
