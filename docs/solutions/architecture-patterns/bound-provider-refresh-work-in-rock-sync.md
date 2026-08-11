---
title: Bound provider refresh work inside shared Rock sync jobs
date: 2026-08-12
category: architecture-patterns
module: Rock daily Bible reading sync
problem_type: architecture_pattern
component: background_job
severity: high
applies_when:
  - A Rock snapshot depends on content or delivery metadata from another provider
  - Historical provider data expires and must refresh inside a recurring reconciliation job
  - Partial external failures must preserve valid rows while still alerting operators
tags: [rock-rms, api-bible, payload, synchronization, background-jobs, reliability]
---

# Bound provider refresh work inside shared Rock sync jobs

## Context

The Daily Bible Reading importer mirrors sent Rock communications into Payload, then asks API.Bible for the CSB passage and provider delivery metadata. New readings and expired historical rows can become pending at the same time. Processing that complete set serially would let historical refresh work consume the shared Rock worker's runtime and delay the newest reading.

## Guidance

Separate stable source data from refreshable provider delivery data. The importer preserves Rock-derived fields while existing rows receive only the API.Bible fields assembled in `scriptureData` (`src/sync/daily-bible-readings.ts:73`, `src/sync/daily-bible-readings.ts:176`). This keeps the source communication identity and prompts stable without treating provider attribution and FUMS metadata as permanent.

Bound provider work before opening a transaction. The current importer sorts new readings ahead of legacy rows and stale refreshes, then caps each run at 18 readings (`src/sync/daily-bible-readings.ts:60`, `src/sync/daily-bible-readings.ts:131`). The bound sits below the Rock worker's 14-minute watchdog and works with the API.Bible request timeout (`src/workers/rock-sync.ts:11`, `src/lib/api-bible.ts:121`). Deferred rows remain pending for a later reconciliation run.

Complete the external reads before database mutation and keep them sequential when the provider contract calls for conservative request pacing (`src/sync/daily-bible-readings.ts:146`). Successful provider reads are committed together. Individual failures are quarantined, but a partial failure is also added to `result.errors` after the valid rows commit (`src/sync/daily-bible-readings.ts:149`, `src/sync/daily-bible-readings.ts:213`). The shared worker therefore preserves good data and still exits unsuccessfully so operators and the next scheduled reconciliation see the missing work (`src/workers/rock-sync.ts:39`).

Enforce publication at the collection boundary. Public Payload reads filter on `isPublished`, while editorial roles can inspect unpublished rows (`src/collections/DailyBibleReadings.ts:6`). Page-level filters remain useful, but they are not a substitute for collection access because Payload also exposes generated API routes.

## Why This Matters

A recurring sync budget belongs to every entity that runs after the importer, not only to the current integration. Prioritization and a hard batch bound make the newest content predictable even when the historical cache expires at once. Reporting partial provider failures as errors prevents a green scheduled run from hiding a missing daily reading, while committing valid rows avoids turning one provider failure into an all-or-nothing outage.

## When to Apply

- A Rock record cannot publish until another service supplies content or metadata.
- Provider responses expire and historical rows need periodic refresh.
- The importer runs inside a shared worker with a fixed watchdog.
- A partial provider outage should preserve valid new rows but must remain operationally visible.

## Examples

Avoid an unbounded historical refresh loop inside the shared job:

```ts
for (const reading of everyExpiredReading) {
  await fetchProviderData(reading)
}
```

Prefer explicit priority, a per-run bound, external reads before the transaction, and error reporting after valid rows commit:

```ts
const batch = pending
  .sort(newFirstThenLegacyThenStale)
  .slice(0, providerBatchLimit)

const prepared = await fetchProviderDataSequentially(batch)
await commitValidRows(prepared.valid)

if (prepared.failed.length > 0) {
  result.errors.push(summarizeProviderFailures(prepared.failed))
}
```

## Related

- `docs/solutions/architecture-patterns/rock-service-guide-snapshot-mirror.md`
- `docs/solutions/developer-experience/payload-dev-server-database-target-safety.md`
