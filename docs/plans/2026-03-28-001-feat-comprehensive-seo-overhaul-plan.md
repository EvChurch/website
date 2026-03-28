---
title: "feat: Comprehensive SEO Overhaul"
type: feat
status: completed
date: 2026-03-28
origin: docs/brainstorms/2026-03-28-seo-overhaul-requirements.md
---

# feat: Comprehensive SEO Overhaul

## Overview

Transform ev.church from "findable only if you know us" to "discoverable by anyone searching for a church in Auckland." This overhaul covers 20 requirements across structured data, metadata, new content pages, navigation restructuring, heading hierarchy, image SEO, and internal linking. The site already has a solid foundation (Organization JSON-LD, sitemap, OG tags, CMS SEO fields) -- this work enhances and fills gaps rather than building from scratch.

## Problem Statement / Motivation

The website ranks poorly for target queries like "church in Auckland" despite having strong design and clear messaging. A comprehensive site audit revealed: CMS pages can render without meta descriptions, no per-page structured data exists beyond a site-level Organization schema, the H1 on the homepage is a brand line rather than keyword-rich, and key content pages (beliefs, FAQ) that competitors have are missing. (see origin: `docs/brainstorms/2026-03-28-seo-overhaul-requirements.md`)

## Proposed Solution

A phased implementation across 5 phases, ordered by dependency chain and impact. Each phase is independently deployable and testable.

## Technical Approach

### Resolved Technical Decisions

These questions were deferred from brainstorming and are resolved here based on codebase analysis:

1. **Hero H1 swap (R1)**: Add a `semanticH1` boolean field to the HeroBlock config. When `true`, the eyebrow renders as `<h1>` and the heading renders as `<h2>`. Default: `false`. Set to `true` only on the homepage seed data. This avoids a homepage-only conditional in the component and allows future pages to opt in. Requires Payload type regeneration.

2. **FAQ and What We Believe pages (R6, R7)**: Implement as **hardcoded pages** (like campus pages and privacy). The beliefs content is stable theological statements that rarely change. FAQ content should be keyword-optimized and tightly controlled. Hardcoding avoids CMS overhead and lets us embed JSON-LD directly. If the church team later needs to edit these, they can be migrated to CMS pages.

3. **URL slugs**: `/what-we-believe` (matches natural search phrasing, high-intent query) and `/faq` (concise, universally recognized).

4. **Meta title template clash**: The layout defines `title.template: '%s | Ev Church'`. CMS `seo.metaTitle` values must bypass the template to avoid double-suffixing. Fix: in `[slug]/page.tsx`, return `title: { absolute: seo.metaTitle }` when a CMS metaTitle is provided. Write R18 titles as complete, final titles (no "| Ev Church" suffix needed in CMS data since the template handles the fallback case).

5. **Sitemap**: Refactor to dynamically query all published pages from the CMS `pages` collection instead of maintaining a hardcoded static routes list. Keep campuses and blog-posts collection queries as-is.

6. **BreadcrumbList (R15)**: Use navigation hierarchy for pages that appear under a parent in the nav (e.g., About > What We Believe). Use URL path for pages with meaningful depth (e.g., /campus/north). For flat pages like /contact, breadcrumb is simply Home > Contact.

7. **About page beliefs migration (R6)**: Keep a brief "What We Believe" heading and 2-sentence summary on the /about page with a "Read more" link to `/what-we-believe`. This preserves the `#what-we-believe` anchor for any external links and the footer link, providing a graceful redirect path.

8. **Article schema (R16)**: **Defer** until blog is CMS-connected. Current blog posts are placeholder lorem ipsum. Adding Article schema to fake content risks a Google structured data penalty. Build the component but only activate when blog posts come from CMS with `_status: 'published'`.

9. **Per-campus schema (R4)**: Create a shared `CampusJsonLd` component that accepts campus data props. The existing `campusData` record needs minor restructuring -- split `address` string into `streetAddress` and `addressLocality` for proper PostalAddress mapping.

10. **Fallback description (R17)**: Implement in `[slug]/page.tsx` `generateMetadata`. Template: `"Learn about {page.title} at Ev Church, a Christian community across Auckland, Tamaki Makaurau."` This runs only when `seo.metaDescription` is empty.

### Additional Fix: ogImage Field Wiring

The Pages collection defines an `seo.ogImage` upload field (`src/collections/Pages.ts:105-112`) but no `generateMetadata` function reads it. Wire this up in both the homepage and `[slug]` route to populate `openGraph.images`. Minimal code change, significant social sharing improvement.

### Additional Fix: Organization JSON-LD Missing Unichurch

The existing `OrganizationJsonLd.tsx` only lists North and Central addresses. Add the Unichurch PostalAddress.

### Implementation Phases

#### Phase 1: Foundation -- Heading Hierarchy & Metadata Infrastructure

**Why first:** Touches block components and metadata patterns used everywhere. All subsequent phases build on correct heading structure and metadata handling.

**Tasks:**

- [ ] **R1: Hero block semantic H1 field** (`src/blocks/Hero.ts`, `src/components/blocks/HeroBlockComponent.tsx`)
  - Add `semanticH1` boolean field to Hero block config with `interfaceName: 'HeroBlock'` preserved
  - When `true`: eyebrow renders as `<h1 className="...eyebrow styles...">`, heading renders as `<h2 className="...display heading styles...">`
  - When `false` (default): current behavior (eyebrow as `<p>`, heading as `<h1>`)
  - Update homepage seed data to set `semanticH1: true` and eyebrow to "Christian Church in Auckland"
  - Run `npx payload generate:types`

- [ ] **R11: Heading hierarchy audit** (`src/components/blocks/PageHeaderBlockComponent.tsx`, `src/components/blocks/HeroBlockComponent.tsx`)
  - Verify no page uses both `hero` and `pageHeader` blocks (both render H1)
  - If any page does, add a `headingLevel` field to `PageHeaderBlock` to allow H2
  - Audit all block components to confirm H2/H3 nesting under the single H1

- [ ] **Meta title template fix** (`src/app/(frontend)/[slug]/page.tsx`)
  - Change line ~50 from `const title = seo?.metaTitle ?? ...` to return `title: { absolute: seo.metaTitle }` when CMS title exists, preserving the template fallback for the `page.title` case
  - Same fix in `src/app/(frontend)/page.tsx` for the homepage

- [ ] **R17: Fallback meta descriptions** (`src/app/(frontend)/[slug]/page.tsx`)
  - Replace `const description = seo?.metaDescription ?? undefined` (line 51) with:
    ```typescript
    const description = seo?.metaDescription ??
      `Learn about ${page.title} at Ev Church, a Christian community across Auckland, Tamaki Makaurau.`
    ```

- [ ] **ogImage wiring** (`src/app/(frontend)/[slug]/page.tsx`, `src/app/(frontend)/page.tsx`)
  - Read `seo.ogImage` from the page data (cast properly with the Media type)
  - If present, add `openGraph.images: [{ url: ogImage.url, width: ogImage.width, height: ogImage.height, alt: ogImage.alt }]`
  - Request `depth: 1` is already used, so the upload relationship will be populated

**Success criteria:**
- Homepage H1 contains "Christian Church in Auckland" in HTML source
- Every page has a meta description (no `undefined` descriptions)
- CMS metaTitle values render without double "| Ev Church" suffix
- Zero pages with multiple H1 tags

---

#### Phase 2: New Content Pages & Navigation Restructure

**Why second:** R6, R7 create the pages that R9 (internal linking), R14 (nav), and R15 (breadcrumbs) need to reference. Must exist before wiring them into navigation and sitemap.

**Tasks:**

- [ ] **R6: What We Believe page** (new file: `src/app/(frontend)/what-we-believe/page.tsx`)
  - Hardcoded page (like privacy/hs pages)
  - Migrate beliefs content from the About page seed data accordion (7 theological items: About God, Humanity, Bible, Jesus Christ, Salvation, Holy Spirit, The Church)
  - Use the same visual pattern as the accordion on the About page
  - Static metadata export:
    ```typescript
    export const metadata: Metadata = {
      title: { absolute: 'What We Believe | Ev Church Auckland | Core Beliefs' },
      description: 'Explore the core beliefs of Ev Church Auckland. What we believe about God, Jesus, the Bible, salvation, and the church. An evangelical Christian community in Tamaki Makaurau.',
      // ... openGraph, twitter, alternates
    }
    ```
  - Include "Auckland" and "Tamaki Makaurau" (R13)

- [ ] **R6: Update About page seed data** (`src/seed/seed-pages.ts`)
  - Replace the beliefs accordion block with a brief summary section: "What We Believe" heading, 2-sentence summary, "Read more" link to `/what-we-believe`
  - Keep the `#what-we-believe` anchor on the heading for backward compatibility
  - Update the About page `seo.metaTitle` to "About Ev Church | Christian Community in Auckland"

- [ ] **R7: FAQ page** (new file: `src/app/(frontend)/faq/page.tsx`)
  - Hardcoded page with FAQ schema (JSON-LD)
  - Minimum 8-10 questions matching real Auckland church search queries:
    1. "What time are services at Ev Church?" (targets "church service times Auckland")
    2. "Where is Ev Church located?" (targets "church near me Auckland")
    3. "Is Ev Church family-friendly? What about kids?" (targets "kids church program Auckland")
    4. "What denomination is Ev Church?" (targets "evangelical church Auckland")
    5. "What should I wear to church?" (targets "what to wear to church")
    6. "How can I get involved or volunteer?" (targets "volunteer at church Auckland")
    7. "Do you have youth programs?" (targets "youth group Auckland")
    8. "What are connect groups?" (targets "small groups church Auckland")
    9. "Is there parking available?" (practical visitor question)
    10. "How do I find out more about the Christian faith?" (targets "Christianity course Auckland")
  - FAQPage JSON-LD schema embedded in the page
  - Internal links within answers to /visit, /campus/*, /kids, /youth, /connect-groups, /explaining-christianity
  - Static metadata:
    ```typescript
    export const metadata: Metadata = {
      title: { absolute: 'FAQ | Ev Church Auckland | Frequently Asked Questions' },
      description: 'Answers to common questions about Ev Church Auckland. Service times, locations, kids programs, parking, and how to get involved.',
      // ...
    }
    ```

- [ ] **R14: Navigation restructure** (`src/components/layout/Header.tsx`, `src/components/layout/Footer.tsx`)
  - Header: Change `About` from a top-level item to a dropdown group with children:
    ```typescript
    {
      label: 'About',
      href: '/about',
      children: [
        { label: 'About Us', href: '/about' },
        { label: 'What We Believe', href: '/what-we-believe' },
        { label: 'Our Vision', href: '/vision' },
      ],
    }
    ```
  - Remove standalone "Our Vision" top-level item
  - Add "FAQ" link -- either under a suitable parent or as a footer-only link
  - Footer: Update the "About" column:
    ```typescript
    {
      title: 'About',
      links: [
        { label: 'About Us', href: '/about' },
        { label: 'What We Believe', href: '/what-we-believe' },
        { label: 'Our Vision', href: '/vision' },
        { label: 'FAQ', href: '/faq' },
        { label: 'Health & Safety', href: '/hs' },
      ],
    }
    ```

**Success criteria:**
- `/what-we-believe` page renders with beliefs content and proper metadata
- `/faq` page renders with FAQ schema visible in page source
- Navigation shows About as a dropdown with 3 children
- Footer reflects updated structure
- `/about#what-we-believe` still scrolls to a relevant section (summary + link)

---

#### Phase 3: Structured Data

**Why third:** Pages from Phase 2 exist, so we can now add schema across the site.

**Tasks:**

- [ ] **R4: Per-campus Church JSON-LD** (new file: `src/components/seo/CampusJsonLd.tsx`, update `src/app/(frontend)/campus/[slug]/page.tsx`)
  - Create a `CampusJsonLd` component that accepts campus data and renders Church schema:
    ```typescript
    {
      "@context": "https://schema.org",
      "@type": "Church",
      "name": "Ev Church North",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "9-11 Rothwell Avenue",
        "addressLocality": "Rosedale",
        "addressRegion": "Auckland",
        "addressCountry": "NZ"
      },
      "openingHoursSpecification": {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": "Sunday",
        "opens": "10:15",
        "closes": "11:30"
      },
      "parentOrganization": {
        "@type": "Church",
        "@id": "https://ev.church/#organization",
        "name": "Ev Church"
      },
      "url": "https://ev.church/campus/north"
    }
    ```
  - Update `campusData` to split combined address strings into structured fields:
    - `streetAddress`: "9-11 Rothwell Avenue"
    - `addressLocality`: "Rosedale"
    - `addressRegion`: "Auckland"
    - `addressCountry`: "NZ"
  - Render `<CampusJsonLd campus={campus} />` in each campus page's `<head>` or body

- [ ] **R5: Enhance Organization JSON-LD** (`src/components/seo/OrganizationJsonLd.tsx`)
  - Add `@id: "https://ev.church/#organization"` for entity linking
  - Add Unichurch PostalAddress (currently missing)
  - Add `areaServed: { "@type": "City", "name": "Auckland" }`
  - Add `hasMap: "https://www.google.com/maps?q=ev+church+auckland"` (if appropriate)
  - Add `isAccessibleForFree: true` and `publicAccess: true`

- [ ] **R15: BreadcrumbList JSON-LD** (new file: `src/components/seo/BreadcrumbJsonLd.tsx`, integrate in layout or per-page)
  - Create a `BreadcrumbJsonLd` component that accepts an array of `{ name, url }` items
  - Define a nav hierarchy map for breadcrumb generation:
    ```typescript
    const breadcrumbMap: Record<string, { name: string; url: string }[]> = {
      '/what-we-believe': [
        { name: 'Home', url: 'https://ev.church' },
        { name: 'About', url: 'https://ev.church/about' },
        { name: 'What We Believe', url: 'https://ev.church/what-we-believe' },
      ],
      '/vision': [
        { name: 'Home', url: 'https://ev.church' },
        { name: 'About', url: 'https://ev.church/about' },
        { name: 'Our Vision', url: 'https://ev.church/vision' },
      ],
      // Campus pages generated dynamically
      // Flat pages: Home > Page Title
    }
    ```
  - For campus pages: Home > Visit > {Campus Name}
  - For blog posts: Home > Blog > {Post Title}
  - Render in layout or per-page based on pathname

- [ ] **R16: Article JSON-LD (deferred component)**
  - Build `ArticleJsonLd` component but do **not** render it on current placeholder blog pages
  - Component accepts: `headline`, `author`, `datePublished`, `dateModified`, `image`, `publisher`
  - Add a `// TODO: Activate when blog is CMS-connected` comment
  - This is prep work only -- no visible schema until blog migration

**Success criteria:**
- Each campus page has Church JSON-LD in page source with proper address and service times
- Organization JSON-LD includes all 3 campuses and `areaServed`
- BreadcrumbList schema renders on all pages
- Google Rich Results Test validates all schemas

---

#### Phase 4: Metadata Optimization & Image SEO

**Why fourth:** All pages exist and structured data is in place. Now optimize the metadata and images that drive click-through from search results.

**Tasks:**

- [ ] **R18: Seed data meta title/description optimization** (`src/seed/seed-pages.ts`)
  - Update `seo.metaTitle` and `seo.metaDescription` for all pages with keyword-optimized versions:

  | Page | metaTitle | metaDescription |
  |------|-----------|-----------------|
  | Home | Church in Auckland \| Ev Church \| Sunday Services & Community | Looking for a church in Auckland? Ev Church is a community of Christ-followers meeting across Tamaki Makaurau. Join us this Sunday. |
  | Visit | Visit Ev Church Auckland \| Plan Your First Sunday | Planning your first visit to Ev Church? Find service times, locations, parking info, and what to expect at our Auckland campuses. |
  | About | About Ev Church \| Christian Community in Auckland | Meet the Ev Church team and learn about our story. A Christ-centred community across Auckland, Tamaki Makaurau since 2012. |
  | Kids | Kids Church Program Auckland \| Ev Kids \| Ages 0-12 | Ev Kids is a safe, fun program for children aged 0-12, running every Sunday at Ev Church Auckland. Creche, Explorers, and Adventurers. |
  | Youth | Youth Group Auckland \| Ev Youth \| Friday Nights | Ev Youth is for teenagers on Auckland's North Shore. Friday nights filled with community, faith, and fun. Junior and Senior Youth. |
  | Connect Groups | Connect Groups Auckland \| Small Groups at Ev Church | Join a Connect Group at Ev Church Auckland. Young adults, couples, women, men, and families meeting weekly across the city. |
  | Explaining Christianity | Christianity Course Auckland \| Explore Faith at Ev Church | Curious about the Christian faith? Join Explaining Christianity at Ev Church Auckland. Relaxed, no-pressure, all questions welcome. |
  | Newish Connect | New to Ev Church Auckland? \| Newish Connect | Just started coming to Ev Church? Newish Connect is the perfect way to meet people and find where you belong. |
  | Contact | Contact Ev Church Auckland \| Get in Touch | Get in touch with Ev Church Auckland. Find our campus addresses, service times, and contact details. |
  | Easter | Easter Services Auckland 2026 \| Ev Church | Join Ev Church for Easter 2026. Special services at North, Central, and Unichurch campuses across Auckland. |
  | Vision | Our Vision \| Ev Church Auckland \| 2030 Goals | Discover Ev Church's vision for 2030. Four big goals for our Christian community across Auckland, Tamaki Makaurau. |
  | Next Steps | Next Steps at Ev Church Auckland \| Get Connected | Ready to take the next step? Explore courses, groups, and programs at Ev Church Auckland. |

  Note: These are stored as complete titles. The `[slug]` route uses `title: { absolute: metaTitle }` (from Phase 1 fix) so the layout template does not double-suffix.

- [ ] **R8: Hardcoded page metadata optimization**
  - Campus pages: Enhance Unichurch description (R19): `"Join Unichurch at the University of Auckland. A student church for university and tertiary students. Sunday 5:15 pm."`
  - Blog listing: Update to `"Stories and reflections from Ev Church Auckland. Faith, community, and life in Tamaki Makaurau."`
  - Blog posts (R20): Improve placeholder metadata. Instead of title-casing the slug, use a static description: `"Read this article from Ev Church Auckland."` (Minimal improvement since blog is placeholder -- real fix comes with CMS migration.)

- [ ] **R10: Image alt text audit** (`src/seed/seed-pages.ts` image manifest, `src/app/(frontend)/campus/[slug]/page.tsx`)
  - Update image manifest alt text to be descriptive and keyword-relevant:
    - `"Ev Church community gathering"` -> `"Sunday morning community gathering at Ev Church Auckland"`
    - `"Worship at Ev Central"` -> `"Live worship at Ev Church Central campus in Hillsborough Auckland"`
    - `"Students at Unichurch"` -> `"University students at Unichurch, Ev Church's student campus in Auckland"`
    - etc. (all 35 images in manifest)
  - Update campus page gallery alt text similarly
  - Ensure all `<img>` tags have non-empty `alt` attributes

**Success criteria:**
- Every page has a unique, keyword-rich meta title and description
- No page renders "undefined" or empty description
- Image alt text includes location keywords where natural
- Unichurch metadata targets student-specific search terms

---

#### Phase 5: Content & Internal Linking

**Why last:** All pages, metadata, and structured data are in place. This phase adds the content sections and contextual links that tie everything together.

**Tasks:**

- [ ] **R2: Homepage keyword-rich intro section** (`src/seed/seed-pages.ts`)
  - Add a new `content` block after the hero in the homepage seed data
  - 150-300 words covering:
    - What Ev Church is (Christian community, Christ-followers)
    - Where campuses are (North Shore, Central Auckland, University)
    - What to expect (welcoming, relaxed, families, students)
    - Include "Auckland" and "Tamaki Makaurau" naturally (R13)
  - Include natural internal links: "plan your visit" -> /visit, "three campuses" -> /campus/north etc., "connect groups" -> /connect-groups, "learn about what we believe" -> /what-we-believe

- [ ] **R3: "New here?" section on homepage** (`src/seed/seed-pages.ts`)
  - Add a `featureGrid` or `manualCardGrid` block with quick-scan info:
    - Service times (Sunday 10:15am North/Central, 5:15pm Unichurch)
    - Locations (brief address, link to campus page)
    - What to expect (relaxed, family-friendly, ~75 min)
    - CTA: "Plan Your Visit" linking to /visit

- [ ] **R9: Contextual internal links**
  - Homepage intro (R2): links to /visit, /campus/*, /connect-groups, /what-we-believe, /about
  - FAQ answers (R7): links to /visit, /campus/*, /kids, /youth, /connect-groups, /explaining-christianity
  - About page beliefs summary (R6): link to /what-we-believe
  - What We Believe page: link to /about (team), /explaining-christianity (explore further)
  - Campus pages: add "Plan Your Visit" CTA linking to /visit (already exists on some)
  - These links should be within paragraph text, not just button CTAs

- [ ] **R12: Sitemap update** (`src/app/sitemap.ts`)
  - Refactor static routes: replace hardcoded list with dynamic query of all published CMS pages:
    ```typescript
    const pages = await payload.find({
      collection: 'pages',
      depth: 0,
      select: { slug: true, updatedAt: true },
      limit: 200,
      where: { _status: { equals: 'published' } },
    })
    const pageRoutes = pages.docs.map(p => ({
      url: p.slug === 'home' ? SITE_URL : `${SITE_URL}/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: p.slug === 'home' ? 1 : 0.7,
    }))
    ```
  - Add hardcoded routes for non-CMS pages: `/what-we-believe`, `/faq`, `/blog`, `/privacy`, `/hs`
  - Keep existing campus and blog-posts collection queries
  - Ensure blog query filters by `_status: 'published'` (already does)

- [ ] **R13: Bilingual coverage**
  - Verify "Tamaki Makaurau" appears in: homepage meta description (already does), homepage intro content (R2), What We Believe page, FAQ page, About page description
  - Use naturally -- not forced keyword stuffing

**Success criteria:**
- Homepage has a keyword-rich intro section with internal links
- Homepage has a "New here?" quick-scan section
- Internal links connect key pages within paragraph text (not just nav/buttons)
- Sitemap dynamically includes all published CMS pages plus hardcoded pages
- "Tamaki Makaurau" appears in at least 4 key pages

---

## System-Wide Impact

### Interaction Graph

- **Phase 1 (heading/metadata)**: Changes to `HeroBlockComponent` affect every page with a hero block (all 12+ CMS pages). The `semanticH1` field defaults to `false` so existing pages are unaffected unless seed data is updated. The `[slug]` metadata fix affects all CMS-managed pages.
- **Phase 2 (new pages)**: New routes at `/what-we-believe` and `/faq` -- no existing routes affected. Nav changes in Header/Footer affect all pages visually.
- **Phase 3 (structured data)**: JSON-LD components render in `<script>` tags -- no visual impact, no interaction with existing components.
- **Phase 4 (metadata)**: Seed data changes require re-seeding the database. No runtime code changes.
- **Phase 5 (content)**: Seed data changes to homepage blocks require re-seeding.

### Error & Failure Propagation

- If `semanticH1` field is missing from existing hero block data, component falls back to `false` (current behavior). No error.
- If `seo.ogImage` relationship is null/undefined, the `openGraph.images` field is simply omitted. No error.
- Sitemap dynamic query: if Payload is unavailable, `payload.find()` will throw. The existing pattern does not handle this (same risk as current code). Low risk since sitemap is generated at build time.

### State Lifecycle Risks

- **Seed data changes require re-seeding**: Phases 1, 4, and 5 modify seed data. If the database already has content, re-seeding may overwrite CMS edits. Recommend re-seeding only in development or using Payload's update API to patch specific fields.
- **Nav changes are code-level**: No database state involved. Changes deploy immediately.

### API Surface Parity

- The `HeroBlock` schema change (new `semanticH1` field) must be reflected in: block config (`src/blocks/Hero.ts`), component (`HeroBlockComponent.tsx`), seed data, and generated types. All four must stay in sync.
- New pages (`/what-we-believe`, `/faq`) must be added to: the sitemap, the navigation (header + footer), and the breadcrumb map.

### Integration Test Scenarios

1. **Homepage H1 verification**: Load homepage, inspect HTML, confirm single `<h1>` with keyword content and `<h2>` with brand line.
2. **CMS page without SEO fields**: Create a page in Payload with no metaTitle or metaDescription. Load it. Confirm fallback description renders in HTML source and title uses template.
3. **Campus structured data**: Load `/campus/north`, view page source, validate Church JSON-LD against Google Rich Results Test.
4. **FAQ schema**: Load `/faq`, view page source, validate FAQPage JSON-LD against Google Rich Results Test.
5. **Navigation hierarchy**: Load any page, confirm About dropdown contains About Us, What We Believe, Our Vision.

## Acceptance Criteria

### Functional Requirements

- [ ] Homepage H1 contains "Christian Church in Auckland" in HTML while visually showing brand headline as the large text
- [ ] Every page has a unique, non-empty meta description
- [ ] CMS metaTitle values render as-is without "| Ev Church" double-suffix
- [ ] `/what-we-believe` page is live with migrated beliefs content
- [ ] `/faq` page is live with 8-10 questions and FAQPage JSON-LD
- [ ] Each campus page has per-campus Church JSON-LD
- [ ] Organization JSON-LD includes all 3 campuses and `areaServed: Auckland`
- [ ] BreadcrumbList JSON-LD renders on all pages
- [ ] Navigation shows About as dropdown with What We Believe and Our Vision
- [ ] Footer reflects new navigation structure
- [ ] `/about#what-we-believe` still works (scrolls to summary section)
- [ ] Homepage has keyword-rich intro content with internal links
- [ ] Homepage has "New here?" section with service times and locations
- [ ] Sitemap includes all published CMS pages dynamically plus hardcoded pages
- [ ] Image alt text is keyword-relevant across seed data and campus pages
- [ ] Unichurch metadata targets student-specific search terms

### Non-Functional Requirements

- [ ] All JSON-LD validates against Google Rich Results Test
- [ ] No pages have multiple H1 tags
- [ ] `npx payload generate:types` runs cleanly after block schema changes
- [ ] Existing pages are unaffected by HeroBlock change (semanticH1 defaults to false)

## Dependencies & Prerequisites

- **Payload type regeneration**: Required after Phase 1 (HeroBlock schema change). Run `npx payload generate:types`.
- **Database re-seeding**: Required after Phases 1, 4, and 5 (seed data changes). In production, use targeted updates rather than full re-seed.
- **No external dependencies**: All work is within the existing codebase and tech stack.

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Seed data re-seeding overwrites CMS edits | Medium | High | Use targeted Payload API updates for production. Full re-seed only in dev. |
| FAQ content doesn't match real search queries | Low | Medium | Validate questions against Google Search Console data after launch. Iterate. |
| Structured data errors penalize rankings | Low | High | Validate all JSON-LD with Google Rich Results Test before deploying each phase. |
| Double H1 regression on future pages | Low | Medium | The `semanticH1` field defaults to false, preventing accidental H1 duplication. Document in CLAUDE.md. |

## Sources & References

### Origin

- **Origin document:** [docs/brainstorms/2026-03-28-seo-overhaul-requirements.md](docs/brainstorms/2026-03-28-seo-overhaul-requirements.md) -- 20 requirements (R1-R20) covering structured data, metadata, new pages, navigation, heading hierarchy, image SEO, and internal linking. Key decisions carried forward: semantic H1 via eyebrow field, About nav group restructure, basic per-campus schema, beliefs migration from About page, FAQ with schema markup.

### Internal References

- Organization JSON-LD: `src/components/seo/OrganizationJsonLd.tsx`
- Hero block component: `src/components/blocks/HeroBlockComponent.tsx:129` (H1 rendering)
- PageHeader block: `src/components/blocks/PageHeaderBlockComponent.tsx:36` (H1 rendering)
- Dynamic page metadata: `src/app/(frontend)/[slug]/page.tsx:36-73`
- Homepage metadata: `src/app/(frontend)/page.tsx:20-60`
- Layout title template: `src/app/(frontend)/layout.tsx:15`
- Navigation: `src/components/layout/Header.tsx:13-40`
- Footer: `src/components/layout/Footer.tsx:8-46`
- Sitemap: `src/app/sitemap.ts`
- Seed data: `src/seed/seed-pages.ts`
- Pages collection SEO fields: `src/collections/Pages.ts:88-114`
- Campus data: `src/app/(frontend)/campus/[slug]/page.tsx:22-80`
- Competitive analysis: `docs/research/auckland-church-seo-analysis.md`

### Institutional Learnings Applied

- `interfaceName` must be set on all new/modified blocks (prevents unpredictable generated type names)
- `npx payload generate:types` required after collection/block changes
- `revalidateTag(tag, 'default')` requires two arguments in Next.js 16
- `params` and `searchParams` are Promises -- always `await` in new page components
- Sitemap must filter blog posts by `_status: 'published'`
- `depth: 0` or `depth: 1` on all Payload Local API calls
