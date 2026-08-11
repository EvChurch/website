---
title: Rock attendance metrics must use real occurrences
date: 2026-08-11
category: integration-issues
module: Connect Group leader attendance
problem_type: integration_issue
component: service_object
symptoms:
  - Church attendance percentages can include services that never occurred
  - Optional attendance metrics can delay the entire Connect Group roster
root_cause: logic_error
resolution_type: code_fix
severity: high
tags: [rock-rms, attendance, connect-groups, reliability]
---

# Rock attendance metrics must use real occurrences

## Problem

Church attendance was initially inferred from generated Sundays. That can count cancelled services as absences and miss valid non-Sunday service occurrences. The optional metrics also inherited the general Rock client's retry and timeout budget, so a degraded Rock API could delay the leader's whole roster.

## Symptoms

- Church percentages include invented absences for dates with no usable Rock occurrence.
- Attendance attached to cancelled or filtered-out occurrences can re-enter through its fallback timestamp.
- The leader page waits through multiple retries for metrics that are not required to show the roster.

## What Didn't Work

- Generating a weekly Sunday calendar does not reflect Rock's actual service schedule.
- Filtering only the occurrence list is insufficient when attendance records can fall back to `StartDateTime` after their explicit occurrence was removed.
- Applying the shared Rock retry policy to best-effort page enrichment makes an optional dependency part of the critical path.

## Solution

Build church marks from the dates of real, completed Rock attendance occurrences. If an attendance record names an occurrence that is not in the usable occurrence map, discard it rather than falling back to the record timestamp. The relevant logic is in `src/lib/members/attendance.ts:97-142` and `src/lib/members/attendance.ts:188-230`.

Fetch the shared weekend-service occurrence calendar through a short-lived Next.js cache, while giving all attendance-specific Rock requests a short timeout and no retry. The cache and request boundaries are in `src/lib/members/attendance.ts:275-301` and `src/lib/members/attendance.ts:326-373`. `rockFetchAll` accepts and forwards those request options in `src/lib/rock-api.ts:90-120`.

Keep attendance enrichment best-effort at the member-data boundary: if it fails, log the failure and return the authorized roster with `attendance: null`.

## Why This Works

The occurrence collection is the calendar of gatherings that Rock actually recorded. Removing cancelled and future occurrences before calculating marks prevents false absences. Rejecting records whose explicit occurrence is unavailable keeps filtered data from bypassing that rule. A small cache avoids reloading the global service calendar for every leader request, and the narrow request budget prevents optional metrics from dominating page latency.

## Prevention

- Test cancelled occurrences, non-Sunday services, attendance with an unavailable explicit occurrence, and a failed Rock attendance request.
- Represent unavailable aggregate data as no data, never as zero percent.
- Keep authorization and the core roster independent from optional external metrics.

## Related Issues

- `docs/solutions/architecture-patterns/rock-service-guide-snapshot-mirror.md`
- `docs/solutions/security-issues/rock-form-capability-boundaries.md`
