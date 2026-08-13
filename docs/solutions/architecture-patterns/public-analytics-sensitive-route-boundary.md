---
title: Separate aggregate analytics boundaries from useful session replay
date: 2026-08-12
last_updated: 2026-08-13
category: architecture-patterns
module: Website analytics and observability
problem_type: architecture_pattern
component: frontend_stimulus
severity: high
applies_when:
  - Google Analytics and PostHog serve different observability purposes
  - Session replay should cover the whole frontend while form values remain private
  - Visitor feedback should link support staff to the originating replay moment
tags: [analytics, posthog, google-analytics, session-replay, feedback, nextjs]
---

# Separate aggregate analytics boundaries from useful session replay

## Context

The website uses Google Analytics for aggregate traffic measurement and PostHog for product analytics, browser error capture, and session replay. Applying one route policy to both tools made replay unavailable on important journeys, while PostHog's default masking made the remaining recordings too incomplete to diagnose layout and content problems.

The intended boundary is now tool-specific: Google Analytics remains excluded from sensitive routes, while PostHog replay runs broadly across the frontend. Visible text, element attributes, styles, and images are replayed; values entered into form controls remain masked.

## Guidance

Keep the Google Analytics route decision in the tested `canTrackAnalyticsPath` helper. Do not use that decision to stop PostHog replay.

Configure PostHog once in `src/components/seo/AnalyticsManager.tsx` with replay enabled, text and element-attribute masking disabled, and `session_recording.maskAllInputs: true`. Explicit never-match selectors override stricter remote project masking rules so dashboard configuration cannot silently turn the replay back into a page of placeholders. Calling `startSessionRecording(true)` forces recording even when a remote sampling decision would otherwise exclude the session.

Feedback submissions call `posthog.get_session_replay_url({ withTimestamp: true })` immediately before sending. The server must treat this URL as untrusted input: `parsePostHogReplayUrl` accepts only HTTPS URLs on the configured PostHog UI origin, for the configured project token and exact replay path, with a single numeric timestamp. It derives the session ID and reconstructs the canonical URL before persistence. The Payload admin field repeats that validation and renders invalid stored values as plain text rather than clickable links.

Store replay metadata as nullable fields in an additive migration so feedback still succeeds when PostHog is unavailable or a session has no replay URL. Keep notification delivery independent from persistence: a replay link enriches an accepted feedback record but is not required to accept the submission.

## Why This Matters

Google Analytics exclusion and PostHog input masking solve different problems. Route exclusion limits aggregate tracking on selected journeys. Input masking prevents typed values from appearing in replay while preserving the page context needed to understand what the visitor saw. A timestamped, server-validated replay link turns a feedback comment into actionable diagnostic evidence without trusting an arbitrary admin hyperlink.

## When to Apply

- A support or feedback workflow needs the page state surrounding a visitor report.
- Default session replays are missing styles, images, or readable text.
- PostHog remote configuration may be stricter than the application's explicit capture policy.
- Replay URLs cross a public API boundary and later become clickable in an admin UI.

## Example

The essential PostHog replay boundary is:

```ts
posthog.init(projectToken, {
  disable_session_recording: false,
  mask_all_text: false,
  mask_all_element_attributes: false,
  session_recording: {
    blockSelector: ':not(*)',
    maskAllInputs: true,
    maskAllElementAttributes: false,
    maskTextSelector: ':not(*)',
  },
})

posthog.startSessionRecording(true)
```

## Related

- `docs/solutions/security-issues/rock-form-capability-boundaries.md`
- `docs/solutions/architecture-patterns/auth0-authentication-payload-authorization.md`
