---
title: Full-Bleed Latest Sermon - Plan
type: feat
date: 2026-08-06
topic: full-bleed-latest-sermon
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
---

# Full-Bleed Latest Sermon - Plan

## Goal Capsule

- **Objective:** Give the Latest Sermon block a full-bleed dark background while keeping it separate from the Upcoming Events block.
- **Product authority:** The confirmed conversation scope governs the visual boundary and the existing Payload block model.
- **Execution profile:** One localized styling change with browser and build verification.
- **Stop condition:** Stop if the change requires Payload schema, data, sermon behavior, or event-block changes.
- **Tail ownership:** LFG owns implementation, review, verification, PR creation, and CI.

## Product Contract

### Summary

The Latest Sermon block will use a full-width dark presentation while remaining a distinct Payload block and visual section above Upcoming Events.

### Problem Frame

The current Latest Sermon presentation is a rounded, contained card with wide warm-white margins. It looks weak beside the full-width Upcoming Events block below it.

### Requirements

- R1. The Latest Sermon section must extend its dark background across the full viewport width.
- R2. Latest Sermon and Upcoming Events must remain separate Payload blocks and separate visual sections.
- R3. Existing sermon content, data loading, links, playback controls, responsive media behavior, and empty-state behavior must remain unchanged.
- R4. The change must not modify the Upcoming Events block, Payload schemas, or unrelated styling.

### Scope Boundaries

- No Payload field or migration changes.
- No changes to sermon selection or playback behavior.
- No changes to event cards, event filtering, or the Upcoming Events block.
- No optional refactors or adjacent homepage polish.

## Planning Contract

### Key Technical Decisions

- KTD1. **Keep independent block sections.** Preserve the Latest Sermon component's own section boundary and add a restrained separator from the next block. (session-settled: user-directed — chosen over one continuous dark content zone: Payload blocks must remain independently managed and visually distinct.) Governs R1, R2, R4.
- KTD2. **Change only the outer presentation.** Retain the current contained sermon content composition inside the full-bleed section. Governs R1, R3, R4.

### Assumptions

- A subtle border between the dark sections is sufficient to make their boundary visible without introducing another content or configuration option.

## Implementation Units

### U1. Make Latest Sermon full-bleed

- **Goal:** Replace the contained rounded outer card with a full-width dark section that remains visibly separate from Upcoming Events.
- **Requirements:** R1, R2, R3, R4; KTD1, KTD2.
- **Dependencies:** None.
- **Files:** `src/components/blocks/LatestSermonBlockComponent.tsx`.
- **Approach:** Remove only the warm-white and constrained outer wrappers. Keep the existing section, inner content width, media, copy, links, and controls. Remove the outer rounding and add a restrained section boundary.
- **Patterns to follow:** Preserve the component's current responsive layout and the independent section element used by `src/components/blocks/UpcomingEventsBlockComponent.tsx`.
- **Test scenarios:** Test expectation: none -- this unit changes styling classes only and does not alter render conditions or behavior.
- **Verification:** The homepage shows a full-width Latest Sermon background at desktop and mobile widths. Latest Sermon and Upcoming Events have a clear boundary. Existing sermon links and playback controls remain present.

## Verification Contract

- `npm run build` completes successfully.
- Browser verification covers the homepage at desktop and mobile widths.
- Browser verification confirms Latest Sermon and Upcoming Events render as separate full-width sections when both blocks are present.
- The final diff contains no changes outside the plan file and `src/components/blocks/LatestSermonBlockComponent.tsx`, except review-required corrections.

## Definition of Done

- R1-R4 are satisfied.
- U1 verification passes.
- No schema, data, event, or unrelated styling changes are present.
- Abandoned or experimental edits are absent from the final diff.
