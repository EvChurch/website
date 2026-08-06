---
title: Treat Rock launcher data as an atomic verified snapshot
date: 2026-08-07
category: architecture-patterns
module: Rock Service Guide launcher sync
problem_type: architecture_pattern
component: service_object
severity: high
applies_when:
  - Mirroring a complete ordered Rock collection into Payload
  - Deleting local mirror rows that are absent from the upstream snapshot
  - Resolving upstream campus or event GUIDs into website relationships
tags: [rock-rms, payload, synchronization, launcher, data-integrity]
---

# Treat Rock launcher data as an atomic verified snapshot

## Context

The Next Steps launcher needs fast, ordered, campus-aware reads without querying Rock on every page request. That makes a Payload mirror useful, but a destructive reconciliation can turn an empty, truncated, or partially resolved Rock response into deleted or globally visible website content.

## Guidance

Fetch the full source snapshot and every required reference set before opening a database transaction. The Service Guide sync loads items, campuses, events, and connection opportunities before it mutates Payload (`src/sync/service-guide-items.ts:43`, `src/sync/service-guide-items.ts:53`).

Prepare resolved records first, recording diagnostics when a source campus, event, connection opportunity, or usable action cannot be resolved (`src/sync/service-guide-items.ts:115`). Then reconcile creates, updates, deletes, and the sync-state global in one required transaction (`src/sync/service-guide-items.ts:154`, `src/sync/service-guide-items.ts:218`). Roll back the whole reconciliation on any mutation failure (`src/sync/service-guide-items.ts:228`).

Before deletion, reject snapshots that are empty while mirror rows exist or that fall below the explicit size-ratio guard (`src/sync/service-guide-items.ts:172`, `src/sync/service-guide-items.ts:177`). These checks turn suspicious upstream results into a retained last-known-good mirror instead of destructive cleanup.

Preserve source campus GUIDs alongside resolved Payload relationships. At read time, an item with no campus assignment remains global, but an item with assigned GUIDs is hidden unless all website campuses resolve; assignments containing only non-website campuses are also hidden (`src/lib/launcher/service-guide.ts:201`). This avoids treating failed or irrelevant campus resolution as an all-campus item.

## Why This Matters

The mirror is a publication boundary, not merely a cache. Atomic reconciliation keeps ordering and relationships internally consistent, while snapshot guards and fail-closed campus handling prevent an upstream outage or mapping gap from silently changing which next steps visitors see.

## When to Apply

- The upstream API represents a complete collection and missing rows imply deletion.
- Local records resolve foreign identifiers into CMS relationships.
- Website visibility depends on successful reference resolution.
- The previous successful snapshot is safer than a suspicious new response.

## Examples

Unsafe cleanup starts deleting immediately after any response:

```ts
const incoming = await fetchItems()
await deleteMissing(incoming)
await upsert(incoming)
```

The safer pattern completes remote reads, prepares and validates the snapshot, then performs the entire reconciliation transactionally:

```ts
const [items, campuses, events] = await Promise.all([
  fetchItems(),
  fetchCampuses(),
  fetchEvents(),
])
const prepared = resolveReferences(items, campuses, events)
assertPlausibleSnapshot(prepared, existing)
await reconcileInTransaction(prepared)
```

## Related

- `docs/solutions/architecture-patterns/payload-managed-campus-pages.md`
- `docs/solutions/security-issues/rock-form-capability-boundaries.md`
