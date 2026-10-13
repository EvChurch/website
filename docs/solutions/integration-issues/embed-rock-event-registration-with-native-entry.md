---
title: Embed native Rock event registration without reimplementing it
date: 2026-08-21
category: integration-issues
module: public event registration
problem_type: integration_issue
component: rock_sync
root_cause: missing_provider_linkage
resolution_type: integration_pattern
severity: high
tags: [rock-rms, event-registration, iframe, payments, synchronization]
---

# Embed native Rock event registration without reimplementing it

## Problem

Public events synced from Rock did not include the registration action attached to their Event Item Occurrence. Rebuilding Registration Entry in church-web would duplicate Rock's capacity, waitlist, registrant, confirmation, and payment behavior.

## Solution

Keep Rock as the registration system. During event sync, join each `EventItemOccurrence` to its `EventItemOccurrenceGroupMap` and active `RegistrationInstance`. Publish a registration URL only when there is exactly one linkage; missing or ambiguous linkage fails closed.

The Obsidian Registration Entry block expects the numeric `RegistrationInstanceId`, not the instance `IdKey`:

```text
https://registration.ev.church/?RegistrationInstanceId=81
```

Only URLs on the dedicated HTTPS registration host may open in the launcher. The Rock site must allow `https://www.ev.church` in `frame-ancestors`, and every registration step must load the matching iframe-resizer child script. The parent checks the message origin and retains Rock as the owner of registration and payment mutations.

Use the current page as the shareable launcher URL, for example `/events/next-steps?launcher=registration&registrationInstanceId=81`. The launcher accepts only a positive numeric instance ID and constructs the fixed registration origin itself; never place an arbitrary iframe URL in the query string.

## Verification

- Confirm the occurrence belongs to the public Website calendar and has exactly one registration linkage.
- Confirm the numeric instance URL renders anonymously when the template permits anonymous registration.
- Confirm Rock returns a `frame-ancestors` policy containing `https://www.ev.church` and does not return a conflicting frame header.
- Exercise free registration first. Validate paid registration, provider redirects, confirmation, and Rock financial reconciliation separately before enabling a paid event.

## Prevention

- Do not infer registration from the Event Item alone; use the occurrence linkage.
- Do not expose arbitrary synced URLs in the iframe; allow only the dedicated registration origin.
- Do not replace Rock's registration or payment state machine in church-web.
