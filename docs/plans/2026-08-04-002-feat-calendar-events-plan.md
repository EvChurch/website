---
title: "feat: Add public Events pages"
type: "feat"
date: "2026-08-05"
topic: "calendar-events"
artifact_contract: "ce-unified-plan/v1"
artifact_readiness: "implementation-ready"
product_contract_source: "ce-brainstorm"
execution: "code"
---

# Public Events Pages

## Goal Capsule

- Add a polished, searchable Events section using event records already synced into Payload.
- Keep registration in Rock and link visitors there only when the current record says registration is open.
- Ship the smallest useful version: no schema changes, migrations, sync redesign, or native registration.

## Product Contract

### Summary

The site will provide an Elevation-inspired `/events` landing page, campus event pages, and event detail pages. The design will be recognisably EV rather than a copy: bold photography, clear date and location information, simple campus navigation, and a strong red registration action where appropriate.

### Requirements

- R1. `/events` shows the next upcoming event as a feature followed by all upcoming events in chronological order.
- R2. `/events/north`, `/events/central`, and `/events/unichurch` show the same presentation filtered to that campus.
- R3. `/events/[slug]` shows the event title, image or branded fallback, date, time, campus, location, summary, contact details when present, and registration state.
- R4. Open registration links to the existing Rock URL. Full, closed, coming-soon, missing, or invalid registration information never renders an active registration button.
- R5. Listing, campus, and detail pages have server-rendered content, canonical metadata, useful descriptions, Event JSON-LD on details, and sitemap entries.
- R6. Events appears as a top-level Header link and in the Footer.
- R7. The experience is responsive, keyboard-accessible, and remains understandable without an image.

### Acceptance Examples

- AE1. Given future events exist, `/events` features the earliest event and lists every future event once.
- AE2. Given an event belongs to Central, `/events/central` includes it and the other campus pages do not.
- AE3. Given registration is open with a valid `https://rock.ev.church` URL, the detail page offers “Continue to registration”; otherwise it displays the state without an active CTA.
- AE4. Given an event has ended, it no longer appears in upcoming listings but its detail page remains available and identifies it as past.
- AE5. Given no events match a listing, the page shows a useful empty state and links back to all events.

### Scope Boundaries

In scope: public pages, navigation, existing Payload queries, Rock registration handoff, essential metadata/JSON-LD, sitemap, responsive styling, and focused tests.

Out of scope: Payload schema changes, occurrence normalization, manual featured-event configuration, sync/webhook changes, native registration, payments, capacity management, load-more pagination, new monitoring, supporting subpages, and Blog work.

### Key Product Decisions

- Registration completes in Rock. (session-settled: user-approved — chosen over native registration: it preserves the existing operational workflow and keeps this delivery small.) Governs R3-R4.
- Events is a top-level destination. (session-settled: user-directed — chosen over nesting it under another menu: it should be easy to discover.) Governs R1, R6.
- The visual model is feature plus image-led list, not a month calendar. (session-settled: user-approved — chosen over a calendar grid: it is clearer for broad public discovery.) Governs R1-R3, R7.
- SEO is part of the page build. (session-settled: user-directed — chosen over thin links to Rock: event pages should be useful search destinations.) Governs R5.

<!-- ce-section: work-relationships -->
### Related Work

Apprenticeship, Christmas, Counsellors, Terms, and Blog remain separate worktrees and are not dependencies of this plan.

## Planning Contract

### Key Technical Decisions

- KTD1. Query the existing `events` collection directly with `depth: 1`, selecting only public presentation fields. No collection or migration changes.
- KTD2. Treat one Payload event record as one public card and detail page. The current model cannot represent every recurring occurrence, so occurrence normalization is deliberately deferred.
- KTD3. Keep page and query code server-side. Reuse the existing rich-text renderer, media URL conventions, layout tokens, breadcrumb helper, and metadata patterns.
- KTD4. Validate Rock registration URLs against the fixed HTTPS host before rendering an external CTA.

### Assumptions

- Existing event sync continues to supply title, slug, dates, campus, location, summary, image, contact, registration URL, and registration status.
- Campus relationships resolve to slugs `north`, `central`, and `unichurch`.
- Event dates display in `Pacific/Auckland`.

## Implementation Units

### U1. Add shared event queries and presentation components

- **Goal:** Load existing Payload events and present consistent feature, card, status, date, image-fallback, and empty states.
- **Requirements:** R1-R4, R7; AE1, AE3-AE5.
- **Dependencies:** None.
- **Files:** `src/lib/events.ts`, `src/lib/events.test.ts`, `src/components/events/EventFeature.tsx`, `src/components/events/EventCard.tsx`, `src/components/events/EventStatus.tsx`.
- **Approach:** Add typed helpers for upcoming/past classification, campus filtering, date formatting, image resolution, and safe Rock URLs. Keep components presentational and server-compatible.
- **Patterns to follow:** `src/lib/payload.ts`, `src/components/blocks/RichTextRenderer.tsx`, `src/components/layout/Header.tsx`.
- **Test scenarios:** Future ordering; campus filtering including missing campus; ended classification; open registration with trusted URL; all non-open or invalid URL states suppress the CTA; missing image uses branded fallback.
- **Verification:** Helpers pass focused tests and components render without client-only dependencies.

### U2. Add listing, campus, and detail routes

- **Goal:** Publish the public Events information architecture and essential SEO.
- **Requirements:** R1-R5, R7; AE1-AE5.
- **Dependencies:** U1.
- **Files:** `src/app/(frontend)/events/page.tsx`, `src/app/(frontend)/events/north/page.tsx`, `src/app/(frontend)/events/central/page.tsx`, `src/app/(frontend)/events/unichurch/page.tsx`, `src/app/(frontend)/events/[slug]/page.tsx`, `src/components/seo/EventJsonLd.tsx`, `src/app/sitemap.ts`.
- **Approach:** Use Server Components and force dynamic data where required. Share a campus-page renderer, return `notFound()` for unknown slugs, retain known past details, and build metadata/JSON-LD from the same event record shown on screen.
- **Patterns to follow:** `src/app/(frontend)/campus/[slug]/page.tsx`, `src/app/(frontend)/sermons/[slug]/page.tsx`, `src/components/seo/BreadcrumbJsonLd.tsx`.
- **Test scenarios:** All-events and each campus route; empty campus state; unknown detail 404; upcoming and past detail states; metadata canonical; JSON-LD matches visible dates/location/registration state; sitemap includes listing, campus, and event URLs.
- **Verification:** Routes compile and representative pages render with and without optional data.

### U3. Add navigation and finish browser QA

- **Goal:** Make Events discoverable and verify the real responsive experience.
- **Requirements:** R6-R7.
- **Dependencies:** U2.
- **Files:** `src/components/layout/Header.tsx`, `src/components/layout/Footer.tsx`.
- **Approach:** Add Events as a top-level navigation item and a Footer link without restructuring the broader navigation.
- **Test scenarios:** Header active state on listing/detail/campus routes; mobile menu access; Footer link; keyboard focus; mobile/desktop layouts; valid external CTA behavior.
- **Verification:** Browser smoke passes for `/events`, one campus page, one upcoming detail, one past detail when data exists, and empty/fallback states.

## Verification Contract

- `npm test` passes.
- `npm run build` passes.
- Browser QA covers `/events`, all three campus routes, an event detail, mobile navigation, keyboard focus, empty data, fallback imagery, metadata, JSON-LD, and Rock CTA safety.
- No Payload schema, migration, sync, webhook, registration transaction, or unrelated page changes appear in the diff.

## Definition of Done

- R1-R7 and AE1-AE5 are implemented or verified against the current data model.
- Events pages are visually coherent with the EV site and usable at mobile and desktop sizes.
- Open registration links only to trusted Rock destinations; other states do not expose an active registration CTA.
- Canonicals, descriptions, JSON-LD, internal navigation, and sitemap entries are present.
- Tests and production build pass, the branch is reviewed, and a PR is open with CI decided.
