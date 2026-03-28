---
date: 2026-03-28
topic: good-news-page
---

# /good-news — The Gospel Page

## Problem Frame

ev.church has strong doctrinal content (`/what-we-believe`) and a course for exploration (`/explaining-christianity`), but no standalone page that presents the gospel message in an accessible, visual, seeker-friendly way. Seekers visiting the site have no clear entry point to understand what Christianity is actually about without committing to a course or reading formal doctrine. A `/good-news` page fills this gap as a warm, jargon-free gospel presentation inspired by the "Two Ways to Live" theological arc.

## Requirements

- R1. Create a new CMS-managed page at `/good-news` presenting the gospel message
- R2. Theological arc inspired by "Two Ways to Live" but restructured for warmth: start with God's love/purpose for people, move through human brokenness, God's response in Jesus, and invitation to respond -- not bound to the original 6-panel order
- R3. Tone is seeker-facing: warm, accessible, no church jargon, low-pressure. Written in ev.church's voice
- R4. Build three distinct design variants for review:
  - **Variant A: Scroll-driven narrative** -- full-width sections alternating light/dark, bold typography, community photos, immersive vertical storytelling using existing blocks
  - **Variant B: Step-by-step interactive** -- guided panels/stepper with progress indicator, one idea per panel, click/swipe to advance
  - **Variant C: Magazine editorial** -- text-forward layout with pull quotes, inline images, warm reading experience
- R5. End with multiple soft next steps: visit a campus (`/visit`), join Explaining Christianity (`/explaining-christianity`), connect with someone (`/contact` or similar)
- R6. Page uses lots of community photos -- real people, not stock imagery
- R7. URL is `/good-news` -- accessible, jargon-free

## Success Criteria

- All three variants are reviewable side by side so the best direction can be chosen before launch
- A seeker with no church background can read the page and understand the core gospel message
- The page fits naturally into the site's existing navigation and content ecosystem
- Clear next steps are presented without pressure

## Scope Boundaries

- Not a replacement for `/what-we-believe` (formal doctrine) or `/explaining-christianity` (course signup)
- No interactive decision tools, quizzes, or prayer forms -- keep it simple
- No video production required (may embed existing video if available, but not a dependency)
- Content is original to ev.church, not a reproduction of "Two Ways to Live" materials

## Key Decisions

- **URL `/good-news` over `/gospel`**: More accessible to unchurched visitors, avoids insider language
- **"Inspired by" not "faithful to" Two Ways to Live**: Allows restructuring for a warmer entry point (God's love first, not God's authority)
- **Three variants built for comparison**: Lets the team pick the best experiential direction before committing
- **Multiple CTAs over single CTA**: Meets seekers where they are -- some want to visit, some want a course, some want a conversation

## Dependencies / Assumptions

- Community photos are available or can be sourced from existing media library
- Existing block system covers Variants A and C; Variant B will need a new stepper/carousel client component

## Outstanding Questions

### Resolve Before Planning

(none)

### Deferred to Planning

- [Affects R4][Technical] Best approach for Variant B stepper component -- extend existing carousel or build a dedicated component?
- [Affects R4][Technical] How to structure three variants for review -- three separate seed entries, a query param switcher, or three routes (`/good-news/v1`, `/v2`, `/v3`)?
- [Affects R5][Needs research] What existing pages/forms are best suited for the "connect with someone" CTA?
- [Affects R6][Needs research] What community photos are available in the current media library?

## Next Steps

-> `/ce:plan` for structured implementation planning
