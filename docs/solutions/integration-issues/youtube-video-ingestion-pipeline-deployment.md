---
title: "YouTube Video Ingestion Pipeline - Deployment Issues"
category: integration-issues
date: 2026-04-05
severity: high
tags:
  - payload-cms
  - migrations
  - job-queue
  - youtube-api
  - deployment
  - relationship-fields
  - postgresql
module: sermon-pipeline
pattern: multi-layer-debugging
---

# YouTube Video Ingestion Pipeline - Deployment Issues

## Problem Summary

Deploying Phase 1 of the sermon content pipeline (YouTube video ingestion) encountered five sequential failures. Each fix revealed the next issue, creating a cascade pattern where the deployment was blocked at multiple layers simultaneously: migration, job queue, type validation, data dependencies, and parameter tuning.

## Symptoms

- Migration failed on Railway deploy with `enum label "banner" already exists`
- YouTube sync endpoint returned `{"ok": true}` but no sermons were updated
- Job queue showed jobs as queued but never executed
- Sermons showed `pipelineStatus: "none"` with empty `videos` array after sync
- Only 3 out of 10+ expected sermon-to-video matches found

## Investigation Steps

### 1. Migration failure (enum collision)
- Railway logs showed: `Error running migration 20260405_121839 ... enum label "banner" already exists`
- The `banner` value had been added to `enum_pages_blocks_hero_overlay_style` in a previous deploy
- Payload's `migrate:create` included the stale enum addition in the new migration

### 2. Job never executed (queue mismatch)
- API endpoint returned success but no logs from the sync runner appeared
- The task was queued to `default` queue (Payload's default) but `payload.jobs.run()` targeted the `pipeline` queue

### 3. Validation error on update (string vs number ID)
- Logs showed: `Failed to update sermon 1: The following field is invalid: YouTube Videos 1 > Campus`
- The matcher converted campus IDs to strings with `String(campus.id)` but Payload relationship fields require numbers

### 4. Empty campuses collection (missing credentials)
- Matcher logged `No campus record found for "central"` and silently skipped all videos
- Rock RMS API key was not configured in Railway, so the campuses collection was never populated

### 5. Low match count (narrow window)
- Only 3 matches found with 10 videos/channel and 30-day lookback
- Older sermons (Feb-Mar) had matching videos outside the window

## Root Cause

Multiple independent issues at different layers:

1. **Payload migration generator** includes all pending enum changes, even values that already exist in production. Combined with Postgres `ALTER TYPE ADD VALUE` auto-committing outside transactions, a single stale value blocks the entire migration.
2. **Payload job queue** does not set a queue at the task definition level. Queue is determined at queue-time, defaulting to `default`. A mismatch between `.queue()` and `.run()` targets silently drops jobs.
3. **Payload relationship fields** expect numeric IDs. TypeScript type constraints led to `String()` conversion that passed the compiler but failed at runtime.
4. **External dependency** (Rock RMS) must be configured and synced before dependent features (YouTube matcher) can function.
5. **Default parameters** (10 videos, 30-day window) were too conservative for the actual data volume.

## Working Solution

### Fix 1: Idempotent migrations

```typescript
// Wrap enum operations in DO/EXCEPTION blocks
await db.execute(sql`
  DO $$ BEGIN
    CREATE TYPE "public"."enum_sermons_pipeline_status"
      AS ENUM('none', 'video-matched', 'transcribed', ...);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;
`)

// Use IF NOT EXISTS for columns, tables, indexes
ALTER TABLE "sermons" ADD COLUMN IF NOT EXISTS "pipeline_status" ...;
CREATE TABLE IF NOT EXISTS "sermons_videos" (...);
CREATE INDEX IF NOT EXISTS "sermons_videos_order_idx" ...;

// Wrap constraints in DO/EXCEPTION blocks
DO $$ BEGIN
  ALTER TABLE "sermons_videos" ADD CONSTRAINT "sermons_videos_campus_id_fk" ...;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

### Fix 2: Match queue names between queue and run

```typescript
// Wrong: queue to default, run pipeline
await payload.jobs.queue({ task: 'youtubeSync', input: {} })
void payload.jobs.run({ queue: 'pipeline', limit: 1 })

// Right: queue to default, run default
await payload.jobs.queue({ task: 'youtubeSync', input: {} })
await payload.jobs.run({ queue: 'default', limit: 1 })
```

### Fix 3: Keep relationship IDs as numbers

```typescript
// Wrong: converts to string, fails Payload validation
const campusIdMap: Record<string, string> = {}
campusIdMap.central = String(campus.id)

// Right: keep as number
const campusIdMap: Record<string, number> = {}
campusIdMap.central = campus.id
```

### Fix 4: Configure upstream dependencies before running

Set Rock RMS credentials in Railway, trigger full sync to populate campuses before running the YouTube sync.

### Fix 5: Widen matching parameters

```typescript
// youtube-api.ts: fetch more videos
export async function fetchAllCampusVideos(maxResults = 50)

// youtube-matcher.ts: look back further
const cutoffDate = new Date()
cutoffDate.setDate(cutoffDate.getDate() - 90)
```

## Prevention Strategies

### Always make Payload migrations idempotent
Payload's `migrate:create` generates bare SQL that assumes a clean slate. When deploying to production where partial state may exist (from failed migrations, manual changes, or prior deploys), wrap all operations in idempotent patterns: `IF NOT EXISTS`, `DO/EXCEPTION` blocks.

### Validate job queue names match between queue and run
Payload tasks don't declare their queue at the definition level. When an API endpoint queues a job and immediately runs it, the queue name passed to `.queue()` must match `.run()`. Consider defining queue names as constants in a shared module.

### Never convert Payload relationship IDs to strings
Payload Local API expects numeric IDs for relationship fields. Even if TypeScript type constraints suggest string conversion, this will pass the compiler but fail at runtime with an unhelpful "field is invalid" message.

### Check dependency collections before running dependent sync
If a sync depends on data from another collection (e.g., YouTube matcher needs campuses), validate the collection is populated at sync start. Log an explicit error instead of silently producing zero results.

### Test sync parameters against real data volumes
Default limits (video count, lookback window) should be tested against the actual data to ensure reasonable match rates. A 30-day window with weekly sermons only covers ~4 data points.

## Related Documentation

- [Missing Migration Column Not Found](../database-issues/missing-migration-column-not-found.md) - Related Payload migration failure pattern
- [Phases 3-8 Full Build Completion](./phases3-8-full-build-completion.md) - Existing sync patterns and job queue setup
- [Sermon Content Pipeline Plan](../../plans/2026-04-05-001-feat-sermon-content-pipeline-plan.md) - Full pipeline architecture

## Files Changed

- `src/migrations/20260405_121839.ts` - Made idempotent
- `src/app/api/pipeline/youtube-sync/route.ts` - Fixed queue name
- `src/pipeline/youtube-matcher.ts` - Fixed ID types, widened lookback
- `src/lib/youtube-api.ts` - Increased fetch limit
