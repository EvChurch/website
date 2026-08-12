---
title: Offset a Fixed Header for a Configurable Banner
date: 2026-08-12
category: design-patterns
module: frontend-layout
problem_type: design_pattern
component: frontend_stimulus
severity: medium
applies_when:
  - "A dismissible CMS-controlled banner sits above a fixed responsive header"
tags:
  - fixed-header
  - responsive-layout
  - resize-observer
  - payload
---

# Offset a Fixed Header for a Configurable Banner

## Context

Rendering a banner before a fixed header does not keep the two regions separate. A fixed header remains pinned to the viewport and can sit underneath the banner, especially when configurable text wraps at narrow widths.

## Guidance

Treat the banner height as live layout state. Measure the visible banner before paint, observe later height changes, and pass the measured offset to the fixed header. When the banner is dismissed, disabled, or expired, remove the offset in the same state transition so no gap remains.

Keep dismissal independent from layout measurement. Store a versioned dismissal marker in the browser, and let CMS staff change the version only when the invitation should reappear.

## Why This Matters

A fixed numeric offset fails when copy, fonts, or viewport width changes. Measuring the rendered banner keeps navigation visible and operable across responsive layouts while preserving CMS control over the content.

## When to Apply

- A fixed or sticky navigation region must remain below optional content.
- Banner content can wrap or change without a code deployment.
- Dismissal or expiry must restore the original shell without leaving space.

## Examples

The implementation introduced by PR #60 uses a layout effect for the first measurement, `ResizeObserver` for later changes, and a numeric `topOffset` on the fixed header. DOM tests cover initial measurement, resize, dismissal, and zero residual gap. Composed browser verification remains tracked in issue #57.

## Related

- PR #60
- Issue #57
