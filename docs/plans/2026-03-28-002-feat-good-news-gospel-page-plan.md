---
title: "feat: Add /good-news gospel page with three design variants"
type: feat
status: active
date: 2026-03-28
origin: docs/brainstorms/2026-03-28-good-news-page-requirements.md
---

# feat: Add /good-news gospel page with three design variants

## Overview

Create a seeker-facing gospel page at `/good-news` inspired by the "Two Ways to Live" theological arc, restructured for warmth (God's love first). Build three distinct design variants — scroll-driven narrative, step-by-step interactive, and magazine editorial — so the team can compare and choose the best direction.

## Problem Statement / Motivation

ev.church has doctrinal content (`/what-we-believe`) and a course (`/explaining-christianity`), but no standalone page that presents the gospel accessibly to someone with zero church background. Seekers need a warm, jargon-free entry point that explains Christianity without requiring commitment to a course or reading formal theology. (see origin: `docs/brainstorms/2026-03-28-good-news-page-requirements.md`)

## Key Decisions Carried Forward

- **URL `/good-news`** over `/gospel` — accessible to unchurched visitors (see origin)
- **"Inspired by" not "faithful to" Two Ways to Live** — restructure for warmth, God's love first (see origin)
- **Three variants for comparison** — team picks winner before launch (see origin)
- **Multiple soft CTAs** — visit, Explaining Christianity, connect with someone (see origin)

## Proposed Solution

### Variant Structure for Review

Three separate CMS page entries with distinct slugs:

| Variant | Slug | Template |
|---------|------|----------|
| A: Scroll narrative | `good-news-a` | `standard` |
| B: Step-by-step | `good-news-b` | `standard` |
| C: Magazine editorial | `good-news-c` | `standard` |

After the team picks a winner, the chosen variant is re-seeded at slug `good-news` and the others are deleted. This is the simplest approach — no route changes, no query param handling, no sitemap pollution beyond the review period (pages can be set to `_status: 'draft'` to exclude from sitemap during review).

### Gospel Content Arc (All Variants)

The theological narrative flows through ~5 sections, restructured from Two Ways to Live for warmth:

1. **You were made for more** — God created you with purpose and love
2. **Something's broken** — We all feel the gap between how things are and how they should be
3. **God didn't give up** — Jesus came to bridge that gap, lived among us, died for us
4. **Everything changed** — The resurrection means death and brokenness don't get the last word
5. **An open invitation** — This is for you, right now, wherever you are

Each section uses warm, conversational language. No jargon. No em dashes. Content is original to ev.church.

### Variant A: Scroll-Driven Narrative

**Blocks used (all existing):**
- `hero` — cinematic overlay, 70vh, community photo, heading "The Good News"
- `content` (light) — Section 1 with left-aligned image
- `cta` (colorPreset: `dark`) — Section 2, dark background for contrast
- `photoStrip` — community photos break
- `content` (light) — Section 3 with right-aligned image
- `blockquote` (centered) — key scripture
- `cta` (colorPreset: `dark`) — Section 4, dark background
- `content` (light) — Section 5
- `cta` (colorPreset: `primary-red`) — final CTAs: Visit / Explaining Christianity / Contact

**No new blocks or components needed.** Alternating light/dark achieved by interleaving `content` blocks (light background) with `cta` blocks (`dark` colorPreset). This avoids modifying the ContentBlock schema.

### Variant B: Step-by-Step Interactive

**New block required: `gospelStepper`**

Data model (follows AccordionBlock pattern at `src/blocks/AccordionBlock.ts`):

```
gospelStepper block:
  - heading (text) — page-level heading shown above the stepper
  - steps (array, min 2, max 8):
    - stepTitle (text, required) — short label shown in progress indicator
    - heading (text, required) — main heading for this step
    - body (richText/Lexical) — narrative content
    - image (upload, relationTo: media) — optional visual
    - imagePosition (select: left | right | background) — layout control
  - finalCTA (group):
    - heading (text)
    - buttons (array, max 3) — link buttons for next steps
```

**New client component: `GospelStepperComponent`**

- `'use client'` leaf component (following AccordionBlockComponent pattern)
- State: `currentStep` index
- Navigation: Previous/Next buttons + clickable progress dots
- Keyboard: Left/Right arrow keys to navigate
- ARIA: `role="group"`, `aria-label="Gospel presentation"`, `aria-current="step"` on active dot
- Mobile: Swipe support via touch events + visible Previous/Next buttons
- Animation: CSS transition (opacity + translateX) between steps, similar to ScrollReveal pattern
- Progress indicator: "Step N of M" text + dot indicators

**Page composition:**
- `pageHeader` — eyebrow "The Good News", dark theme
- `gospelStepper` — 5 steps matching the content arc, with community photos
- `cta` — final CTAs (redundant with stepper's finalCTA for direct-link visitors)

### Variant C: Magazine Editorial

**Blocks used (all existing):**
- `pageHeader` — dark theme, eyebrow "The Good News", descriptive subtitle
- `content` (left-aligned, with image) — Section 1
- `blockquote` (leftBorder) — pull quote
- `content` (center-aligned) — Section 2
- `content` (right-aligned, with image) — Section 3
- `blockquote` (centered) — scripture
- `content` (left-aligned, with image) — Section 4
- `content` (center-aligned) — Section 5
- `featureGrid` (threeColumn, iconTop) — three next-step options as feature cards
- `cta` (primary-red) — final CTA with buttons

**No new blocks or components needed.** The editorial feel comes from varied `content` block alignments, interspersed `blockquote` blocks for pull quotes, and thoughtful use of community photos.

## Technical Considerations

### New Block Registration (Variant B only)

Files to create/modify:
1. **Create** `src/blocks/GospelStepperBlock.ts` — Payload block config with `interfaceName: 'GospelStepperBlock'`
2. **Create** `src/components/blocks/GospelStepperBlockComponent.tsx` — `'use client'` interactive component
3. **Modify** `src/collections/Pages.ts` — add `GospelStepperBlock` to `layout.blocks` array
4. **Modify** `src/components/blocks/RenderBlocks.tsx` — add case to switch statement and union type
5. **Run** `payload generate:types` and `payload generate:importmap` after block registration

### Seed Data

Add to `src/seed/seed-pages.ts`:
1. Image manifest entries for 6-8 community photos (source from existing `/public/images/` or add new ones)
2. Three `upsertPage()` calls — one per variant — with full block compositions and SEO metadata
3. After review, a cleanup task to delete losing variants and re-seed winner at `good-news` slug

### SEO Metadata

Since this sits on the `feat/seo-overhaul` branch, SEO is first-class:

- **metaTitle:** "What is the Good News? | Ev Church Auckland"
- **metaDescription:** "Discover the message at the heart of Christianity. A simple, honest look at who God is, what went wrong, and the hope that changes everything."
- **BreadcrumbJsonLd:** Add `good-news` to `navHierarchy` map in `src/components/seo/BreadcrumbJsonLd.tsx` (Home > Good News)
- **Draft status during review:** Set `_status: 'draft'` on variant pages to keep them out of sitemap/indexing until winner is chosen

### Navigation

Add `/good-news` to the footer navigation and as a contextual link from `/what-we-believe`. Defer main nav placement to content review — the page should prove its value before earning top-level nav space.

### Community Photos

The seed data manifest already has ~20 community images. Reuse appropriate ones (carousel images, campus community shots). If gaps exist, flag during implementation — this does not block development since placeholder images can be swapped later.

## Acceptance Criteria

- [ ] Three CMS page entries exist (good-news-a, good-news-b, good-news-c) with complete gospel content
- [ ] Variant A uses existing blocks only (hero, content, cta, photoStrip, blockquote) with alternating light/dark sections
- [ ] Variant B introduces a `gospelStepper` block with keyboard navigation, ARIA roles, swipe support, and progress indicator
- [ ] Variant C uses existing blocks only (pageHeader, content, blockquote, featureGrid, cta) with editorial-style layout
- [ ] All three variants present the same 5-section gospel arc with warm, jargon-free content
- [ ] All three variants end with multiple soft CTAs: Visit (`/visit`), Explaining Christianity (`/explaining-christianity`), Contact (`/contact`)
- [ ] All three variants include community photos (real people, not stock)
- [ ] SEO metadata (metaTitle, metaDescription) set on all variant pages
- [ ] BreadcrumbJsonLd updated with `good-news` entry
- [ ] `gospelStepper` block registered in Pages collection and RenderBlocks
- [ ] `payload generate:types` and `payload generate:importmap` run successfully after block changes
- [ ] All variants render correctly on mobile (especially Variant B stepper)
- [ ] No em dashes in any content

## Implementation Phases

### Phase 1: Content & Existing-Block Variants (Variant A + C)

1. Write the gospel content for all 5 sections — this is the creative foundation everything else builds on
2. Add community photo entries to seed image manifest
3. Seed Variant A (scroll narrative) using existing blocks
4. Seed Variant C (magazine editorial) using existing blocks
5. Add SEO metadata to both pages
6. Update BreadcrumbJsonLd with `good-news` nav hierarchy entry

**Deliverable:** Two reviewable pages at `/good-news-a` and `/good-news-c`

### Phase 2: Stepper Block & Variant B

1. Create `GospelStepperBlock.ts` block definition
2. Create `GospelStepperBlockComponent.tsx` client component with:
   - Step navigation (prev/next buttons, progress dots)
   - Keyboard navigation (arrow keys)
   - ARIA accessibility (`role="group"`, `aria-current="step"`)
   - Touch/swipe support for mobile
   - CSS transitions between steps
3. Register block in `Pages.ts` and `RenderBlocks.tsx`
4. Run type generation
5. Seed Variant B page with stepper content
6. Add SEO metadata

**Deliverable:** Third reviewable page at `/good-news-b`

### Phase 3: Navigation & Polish

1. Add `/good-news` link to footer navigation in Header/Footer components
2. Add contextual link from `/what-we-believe` CTA section
3. Review all three variants on mobile, tablet, desktop
4. Verify accessibility (keyboard nav, screen reader) on Variant B
5. Final content review — tone, accuracy, no jargon, no em dashes

**Deliverable:** All three variants ready for team review

### Phase 4: Post-Review (after team picks winner)

1. Re-seed winning variant at slug `good-news`
2. Delete losing variant pages
3. Optionally promote to main nav if team decides
4. Set `_status: 'published'` for production

## Dependencies & Risks

- **Community photos:** Assumes sufficient photos exist in the media library. Mitigated by using existing seed images initially, swapping later if needed.
- **Stepper component complexity:** The gospelStepper is net-new code. Mitigated by following the AccordionBlock pattern closely and keeping the data model simple (no nested blocks).
- **Content quality:** The gospel narrative must be theologically sound and tonally warm. This is a content risk, not a technical one. Mitigated by writing content first (Phase 1, Step 1) so it can be reviewed early.

## Sources & References

### Origin

- **Origin document:** [docs/brainstorms/2026-03-28-good-news-page-requirements.md](docs/brainstorms/2026-03-28-good-news-page-requirements.md) — Key decisions: URL `/good-news`, "inspired by" Two Ways to Live theology, three variants for comparison, multiple soft CTAs

### Internal References

- Page creation pattern: `src/app/(frontend)/[slug]/page.tsx`
- Block definitions: `src/blocks/AccordionBlock.ts` (template for stepper)
- Block rendering: `src/components/blocks/RenderBlocks.tsx`
- Seed data: `src/seed/seed-pages.ts`
- Breadcrumbs: `src/components/seo/BreadcrumbJsonLd.tsx`
- Interactive component pattern: `src/components/blocks/AccordionBlockComponent.tsx`
- Institutional learnings: `docs/solutions/integration-issues/phase3-payload-collections-blocks-globals.md`

### Related Work

- SEO overhaul: `docs/plans/2026-03-28-001-feat-comprehensive-seo-overhaul-plan.md`
- What We Believe page: recent commit `730e60b`
