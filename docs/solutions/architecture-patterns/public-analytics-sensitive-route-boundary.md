---
title: Keep public analytics outside sensitive church journeys
date: 2026-08-12
category: architecture-patterns
module: Website analytics and observability
problem_type: architecture_pattern
component: frontend_stimulus
severity: high
applies_when:
  - Analytics or session replay runs automatically on public pages
  - The same application also serves authenticated, pastoral, giving, or form journeys
tags: [analytics, posthog, google-analytics, session-replay, privacy, nextjs]
---

# Keep public analytics outside sensitive church journeys

## Context

The public website uses Google Analytics for aggregate traffic measurement and PostHog for product analytics, browser error capture, and privacy-masked session replay. The same application also contains member, sign-in, giving, contact, pastoral-care, and Rock form journeys where analytics would create unnecessary privacy risk.

## Guidance

Centralise route policy in a small, tested helper. `canTrackAnalyticsPath` denies all analytics on sensitive route prefixes, while `canReplayPath` uses a narrower public allowlist (`src/lib/analytics-privacy.ts`). Keep query strings out of analytics page URLs so form or campaign parameters cannot accidentally become telemetry.

Configure PostHog conservatively in `src/components/seo/AnalyticsManager.tsx`: do not identify visitors, disable autocapture and console capture, mask text, inputs, and attributes, and block every form plus any element carrying `data-analytics-sensitive`. Add that marker directly to reusable form roots so CMS pages and launcher overlays remain protected regardless of their pathname.

When client navigation moves from a tracked page to a sensitive page, stop replay and exception capture in a layout effect. This closes the render-to-effect window in which the newly committed sensitive DOM could otherwise be observed before an ordinary effect stops recording.

## Why This Matters

Masking and route exclusion solve different problems. Masking limits what an allowed replay contains; route exclusion prevents sensitive journeys from becoming analytics sessions at all. Form-level markers provide a second boundary for components that can appear on arbitrary CMS pages.

## When to Apply

- A public website includes authenticated or pastoral-care areas.
- Session replay is enabled without a blocking consent banner.
- Forms can be embedded into CMS-managed pages or global launchers.
- A client-side router can cross from public to sensitive content without a full reload.

## Examples

Treat replay as an explicit allowlist, not the inverse of a deny list:

```ts
export function canReplayPath(pathname: string): boolean {
  if (!canTrackAnalyticsPath(pathname)) return false
  return pathname === '/' || REPLAY_PUBLIC_PREFIXES.some((prefix) =>
    matchesPathPrefix(pathname, prefix),
  )
}
```

## Related

- `docs/solutions/security-issues/rock-form-capability-boundaries.md`
- `docs/solutions/architecture-patterns/auth0-authentication-payload-authorization.md`
