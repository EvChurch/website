---
date: 2026-03-28
topic: seo-overhaul
---

# Comprehensive SEO Overhaul

## Problem Frame

Ev Church's website is well-designed and clear for people who already know the church, but is not optimized for discovery by people searching for a church in Auckland. The site lacks keyword-aligned heading structure, per-campus structured data, content depth signals (E-E-A-T), and key content pages that competing Auckland churches have. A site-wide audit also revealed that 10+ CMS-managed pages have no guaranteed meta descriptions, the blog is entirely placeholder content, and there is no structured data beyond the site-level Organization schema. The goal is to shift from "findable only if you know us" to "discoverable by anyone searching for a church in Auckland."

## Requirements

### Homepage SEO Structure

- R1. The homepage H1 must contain primary keywords ("Christian Church in Auckland" or similar). Use the existing hero eyebrow field as the semantic H1, styled small/uppercase. The current brand headline ("A place to belong" or similar) becomes an H2 visually displayed as the large display heading. No visual change to the hero layout.
- R2. Add a keyword-rich intro content section after the hero with 150-300 words covering what Ev Church is, where campuses are, and what to expect. Include natural internal links to key pages (visit, campuses, connect groups, about). This section strengthens topical authority and provides crawlable keyword-rich content.
- R3. Add a "New here?" or "What to expect" section on the homepage (above campuses) with quick-scan info: service times, locations, what a Sunday looks like. Serves both SEO and conversion for first-time visitors.

### Structured Data

- R4. Add per-campus Church schema (JSON-LD) on each campus page, including: name, address, service times, and parent organization reference back to the main Ev Church entity. Extend the existing campus data already hardcoded in the repo.
- R5. Enhance the existing site-wide Organization/Church JSON-LD to include `hasMap`, `telephone` (if available), and `areaServed: Auckland`.
- R15. Add BreadcrumbList schema to all pages. Generate from the URL path and page title. Helps Google display breadcrumb trails in search results.
- R16. Add Article schema (JSON-LD) to blog post pages, including: headline, author, datePublished, dateModified, publisher (Ev Church), and image when available.

### New Content Pages

- R6. Create a "What We Believe" page by migrating existing beliefs content from the About page. Important for E-E-A-T (establishing the church's identity and authority) and for searchers evaluating churches. Should include: core beliefs, gospel summary, denomination/affiliation context. The About page retains its other content (team, story, etc.) with the beliefs section removed and linked to the new page instead.
- R7. Create an FAQ page with FAQ schema markup (JSON-LD). Questions should match real search queries for Auckland churches. Minimum 8-10 questions covering: service times, locations, denomination, kids programs, parking, what to wear, how to get involved, beliefs overview. FAQ schema enables rich results in Google search.

### Navigation Restructure

- R14. Restructure the About section in navigation as a parent group containing: "About" (existing page minus beliefs), "What We Believe" (new page with migrated content), and "Our Vision" (existing page, repositioned under About). Update both the Header nav and Footer columns to reflect this structure.

### CMS Metadata Fallbacks

- R17. Add intelligent fallback meta descriptions for all CMS-managed pages served by the `[slug]` route. When the CMS `seo.metaDescription` field is empty, generate a useful description from the page title and a standard template (e.g. "Learn about [page title] at Ev Church Auckland. A Christian community across Tamaki Makaurau."). This ensures no page renders without a meta description.
- R18. Add per-page keyword-optimized meta titles and descriptions in the CMS seed data for all existing pages. Target keywords by page:
  - Visit: "Visit Ev Church Auckland | Sunday Services & What to Expect"
  - About: "About Ev Church | Christian Community in Auckland"
  - Kids: "Kids Church Program Auckland | Ev Kids | Sunday School"
  - Youth: "Youth Group Auckland | Ev Youth | Friday Nights"
  - Connect Groups: "Small Groups Auckland | Bible Study & Community"
  - Explaining Christianity: "Christianity Course Auckland | Explore Faith"
  - Newish Connect: "New to Ev Church? | Newish Connect Auckland"
  - Contact: "Contact Ev Church Auckland | Get in Touch"
  - Easter: "Easter Church Services Auckland | Ev Church"

### Metadata and Internal Linking

- R8. Review and optimize meta titles and descriptions for all hardcoded pages (campuses, blog, privacy, H&S) to include relevant location keywords and compelling descriptions.
- R9. Add contextual internal links within page content. Key link paths: homepage to visit, homepage to campuses, homepage to beliefs, campus pages to visit, about page to beliefs, FAQ to relevant detail pages. Links should be within paragraph text, not just navigation.

### Campus Page Keywords

- R19. Enhance Unichurch campus page metadata and content to target student-specific search terms: "university church Auckland," "student church Auckland," "church near University of Auckland." The current description already mentions students but the meta title and description should be more explicit.

### Image SEO

- R10. Audit and improve image alt text across the site to be descriptive and keyword-relevant. Update the image manifest in seed data. Example: instead of "Ev Church community gathering" use "Sunday service community gathering at Ev Church Auckland." Apply to hero images, gallery images, campus photos, and team photos.

### Technical SEO

- R11. Ensure all pages have proper heading hierarchy (single H1, logical H2/H3 nesting). Audit existing block components to confirm heading levels are semantic.
- R12. Sitemap already exists and includes static routes, campuses, and blog posts. Update it to include new pages (What We Believe, FAQ) once created.
- R13. Include both "Auckland" and "Tamaki Makaurau" in key content areas for bilingual local SEO coverage.
- R20. Blog post metadata must not be generated from slug title-casing. When blog transitions from placeholder to CMS-managed, ensure proper metadata comes from post content (title, excerpt, featured image). For now, improve the placeholder to at least generate reasonable descriptions.

## Success Criteria

- Homepage H1 contains target keywords when inspected in HTML, while visually preserving brand-first hero design
- Each campus page renders its own Church JSON-LD in page source
- Beliefs page and FAQ page are live, indexed, and FAQ page shows FAQ schema in Google's Rich Results Test
- All pages have unique, keyword-relevant meta titles and descriptions (zero pages with missing descriptions)
- Site has contextual internal links connecting key pages (not just nav links)
- Image alt text is descriptive and location-relevant across the site
- BreadcrumbList schema renders on all pages
- Blog posts include Article schema
- Navigation reflects About > What We Believe, Our Vision grouping

## Scope Boundaries

- Performance/Core Web Vitals optimization is a separate workstream (not included here)
- Sermon/media archive is not included in this phase
- "What to Expect on Sunday" is covered as a homepage section (R3), not a standalone page
- Google Business Profile optimization is out of scope (external to the codebase)
- Blog migration from placeholder to CMS is not in scope; only metadata improvements for the current placeholder (R20)
- Topic/pillar pages (e.g. "What is Christianity") are future work, not this phase
- Geo coordinates and Event schema for campuses are future enhancements

## Key Decisions

- **Semantic H1 approach**: Use the hero eyebrow as the HTML H1 (keyword-rich, small text) and the brand headline as H2 (visually large). Preserves brand feel while optimizing for search.
- **Beliefs + FAQ as priority content pages**: These have the best effort-to-impact ratio. Beliefs builds E-E-A-T; FAQ targets long-tail queries with rich result potential.
- **About becomes a nav group**: About -> What We Believe, Our Vision. Beliefs content migrates from About page; Our Vision is an existing page repositioned. About page keeps team/story content.
- **Basic per-campus schema**: Church schema with name, address, service times. No Event schema or geo coordinates in this phase (can be added later with minimal effort).
- **No standalone "What to Expect" page**: This content lives on the homepage and/or visit page to avoid thin page risk and consolidate ranking power.
- **CMS metadata fallbacks**: Template-based fallback descriptions prevent any page from rendering without a meta description, even if the CMS field is empty.

## Dependencies / Assumptions

- Homepage content is CMS-driven (Payload blocks). Hero eyebrow/heading changes may need CMS content updates alongside code changes.
- Campus data is currently hardcoded in the codebase. Schema generation can use this directly.
- Beliefs page content already exists on the About page and will be migrated to the new "What We Believe" page.
- FAQ content will need to be written with real questions that match search intent.
- Navigation is currently hardcoded in the Header component (not CMS-managed). Changes are code-level.
- The `[slug]` route serves all CMS-managed pages. Metadata fallback logic needs to be added there.
- Sitemap already exists at `src/app/sitemap.ts` with static routes, campus routes, and blog routes.
- Blog is currently placeholder data. Full CMS blog migration is a separate workstream.

## Outstanding Questions

### Resolve Before Planning

(None -- all product decisions are resolved.)

### Deferred to Planning

- [Affects R7][Technical] Should FAQ be a Payload CMS-managed page or hardcoded like campus pages? Depends on whether the church team needs to edit it frequently.
- [Affects R6][Technical] Should "What We Believe" be a CMS page or hardcoded? Same consideration as FAQ.
- [Affects R1][Technical] Does the hero block component need a code change to swap H1/H2 tags, or can this be handled via a new block variant?
- [Affects R9][Technical] What's the best approach for internal links within CMS-managed rich text content? Lexical link nodes vs hardcoded sections.
- [Affects R4][Technical] Should per-campus schema be a shared component or generated inline on each campus page?
- [Affects R15][Technical] Best approach for BreadcrumbList -- layout-level component with path parsing, or per-page?
- [Affects R17][Technical] Where to implement the fallback description logic -- in the `[slug]` generateMetadata, or as a Payload hook that auto-populates SEO fields on save?

## Next Steps

-> `/ce:plan` for structured implementation planning
