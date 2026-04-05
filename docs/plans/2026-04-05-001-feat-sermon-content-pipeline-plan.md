---
title: "feat: Sermon Content Pipeline"
type: feat
status: active
date: 2026-04-05
origin: docs/brainstorms/2026-04-05-sermon-content-pipeline-requirements.md
---

# feat: Sermon Content Pipeline

## Overview

Build a three-phase pipeline that enriches existing sermon records with YouTube video, transcriptions, and AI-generated blog content. Phase 1 adds multi-campus video playback to sermon pages. Phase 2 adds transcript-driven sermon segment detection with a custom player. Phase 3 generates and auto-publishes structured blog posts from sermon transcripts using the Anthropic API. All phases are managed via Payload admin with cron scheduling and status visibility.

## Problem Statement

ev.church live-streams services on YouTube across two campus channels (Central and North) but the website only has audio from resources.ev.church. There is no video playback, no way to watch just the sermon portion of a livestream, and no text-based content generated from sermons. This limits SEO discoverability, accessibility, and engagement for people who missed a service or want to go deeper. (see origin: `docs/brainstorms/2026-04-05-sermon-content-pipeline-requirements.md`)

## Proposed Solution

Three phases, each delivering standalone value:

1. **YouTube Video Ingestion** -- Pull videos from two campus channels, match to existing sermon records, add video choice to sermon pages
2. **Transcription & Smart Player** -- Fetch YouTube auto-generated captions, detect sermon boundaries, build a segment-only player
3. **AI Content Generation** -- Generate structured blog posts from transcripts, cross-link with sermon pages for SEO

Key architectural decisions from the brainstorm (see origin):
- YouTube supplements resources.ev.church (does not replace it)
- Auto-detect sermon boundaries with manual override
- Auto-publish blog posts with edit-after capability
- Prominent AI-generated content disclosure
- CSB translation for scripture (up to 1,000 verses permitted without written permission)
- Cross-linked pages for maximum SEO surface

## Technical Approach

### Architecture

```
                    ┌─────────────────────────────────────────┐
                    │          Payload Job Queue               │
                    │  (pipeline queue, separate from sync)    │
                    └──────┬──────────┬──────────┬────────────┘
                           │          │          │
                    ┌──────▼──┐ ┌─────▼────┐ ┌──▼──────────┐
                    │ Phase 1  │ │ Phase 2   │ │ Phase 3      │
                    │ YouTube  │ │ Transcript│ │ AI Generate  │
                    │ Sync     │ │ + Bounds  │ │ + Publish    │
                    └──────┬──┘ └─────┬────┘ └──┬──────────┘
                           │          │          │
                    ┌──────▼──────────▼──────────▼────────────┐
                    │         Sermons Collection               │
                    │  (videos[], transcript, pipelineStatus)  │
                    └──────────────────┬──────────────────────┘
                                       │
                    ┌──────────────────▼──────────────────────┐
                    │         BlogPosts Collection             │
                    │  (sermon relationship, AI disclosure)    │
                    └─────────────────────────────────────────┘
```

### Schema Changes

#### Sermons Collection (`src/collections/Sermons.ts`)

New fields to add:

```typescript
// Video references -- array for multi-campus
{
  name: 'videos',
  type: 'array',
  label: 'YouTube Videos',
  admin: { description: 'YouTube video references per campus' },
  fields: [
    { name: 'campus', type: 'relationship', relationTo: 'campuses', required: true },
    { name: 'youtubeVideoId', type: 'text', required: true },
    { name: 'youtubeUrl', type: 'text', required: true },
    { name: 'thumbnailUrl', type: 'text' },
  ],
}

// Sermon segment timestamps (seconds from video start)
{ name: 'sermonStartSeconds', type: 'number', admin: { description: 'Sermon start time in seconds' } }
{ name: 'sermonEndSeconds', type: 'number', admin: { description: 'Sermon end time in seconds' } }
{ name: 'boundariesAutoDetected', type: 'checkbox', defaultValue: false, admin: { readOnly: true } }
{ name: 'boundariesConfirmed', type: 'checkbox', defaultValue: false, admin: { description: 'Team has confirmed/adjusted timestamps' } }

// Pipeline tracking
{
  name: 'pipelineStatus',
  type: 'select',
  defaultValue: 'none',
  options: [
    { label: 'None', value: 'none' },
    { label: 'Video Matched', value: 'video-matched' },
    { label: 'Transcribed', value: 'transcribed' },
    { label: 'Boundaries Set', value: 'boundaries-set' },
    { label: 'Blog Generated', value: 'blog-generated' },
    { label: 'Complete', value: 'complete' },
    { label: 'Failed', value: 'failed' },
  ],
}
{ name: 'pipelineError', type: 'textarea', admin: { readOnly: true, description: 'Last pipeline error' } }
{ name: 'blogPost', type: 'relationship', relationTo: 'blog-posts' }
```

The existing placeholder fields (`transcript`, `summary`, `discussionQuestions`, `enrichedScripture`) will be populated by the pipeline. The `transcript` field stores the YouTube auto-generated captions for Phase 3 input. The `summary`, `discussionQuestions`, and `enrichedScripture` fields will be populated as a byproduct of blog generation and displayed on the sermon detail page.

#### BlogPosts Collection (`src/collections/BlogPosts.ts`)

New fields:

```typescript
{ name: 'sermon', type: 'relationship', relationTo: 'sermons', admin: { description: 'Source sermon (for AI-generated posts)' } }
{ name: 'isAiGenerated', type: 'checkbox', defaultValue: false, admin: { readOnly: true } }
{ name: 'aiDisclosure', type: 'text', defaultValue: 'This content was generated by AI from a sermon recording and reviewed for accuracy.' }
```

#### Migration

Run `payload migrate:create` after each schema change. Payload does not auto-apply schema changes; builds pass but runtime crashes with `column does not exist` errors without explicit migrations.

### Implementation Phases

#### Phase 1: YouTube Video Ingestion & Matching

**R1, R2, R3, R4, R5** (see origin)

##### 1.1 YouTube API Client

**New file:** `src/lib/youtube-api.ts`

Follow the Rock API client pattern (`src/lib/rock-api.ts`): typed interfaces, exponential backoff retry, custom error class, zero `any`.

```typescript
// Approach: API key (not OAuth) -- sufficient for read-only public channel data
// Quota: 2-3 units per sync (channels.list + playlistItems.list + videos.list)
// Default daily quota: 10,000 units -- hundreds of syncs possible

interface YouTubeVideo {
  videoId: string
  title: string
  publishedAt: string  // ISO 8601
  thumbnailUrl: string
  duration: string     // ISO 8601 duration (PT1H30M)
}

// Step 1: Derive uploads playlist ID from channel ID (UC... → UU...)
// Step 2: playlistItems.list to get recent uploads (1 unit, sorted newest-first)
// Step 3: videos.list to get duration metadata (1 unit, batch up to 50 IDs)
```

**Environment variables:** `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID_CENTRAL`, `YOUTUBE_CHANNEL_ID_NORTH`

**Avoid `search.list`** -- costs 100 units vs 1 unit for `playlistItems.list`.

##### 1.2 YouTube-to-Sermon Matching

**New file:** `src/pipeline/youtube-matcher.ts`

Matching strategy (multi-signal):
1. **Date match** (primary): YouTube `publishedAt` date matches sermon `publishedAt` date (same Sunday)
2. **Title fuzzy match** (secondary): Compare YouTube video title against sermon title/series for confirmation
3. **Duration filter**: Ignore videos shorter than 30 minutes (non-sermon content like promos, worship clips)

Edge cases:
- **No match found**: Mark the YouTube video as unmatched in a log; skip without error. Admin can manually associate via Payload.
- **Non-sermon videos**: Filtered by duration threshold. Optionally filter by day-of-week (Sundays only) or a dedicated YouTube playlist.
- **One campus only**: Store only the available campus video. UI gracefully shows one option.
- **Multiple matches**: Log a warning, prefer exact date match, flag for admin review.

##### 1.3 Sermon Detail Page -- Video Section

**Modified file:** `src/app/(frontend)/sermons/[slug]/page.tsx`

Add a video section above the existing audio player:
- If `videos` array is populated, show campus selector (tabs or buttons for Central/North)
- Each campus option loads a YouTube embed via the YouTube IFrame Player API
- If only one campus has video, show it directly without a selector
- Audio player remains as an equal alternative (not subordinated)

**Video embed approach:** Use the YouTube IFrame Player API directly (not Video.js) for Phase 1. This keeps Phase 1 simple and ships video quickly. The `start` and `end` parameters will be added in Phase 2 when boundaries are available.

**New client component:** `src/components/media/SermonVideoPlayer.tsx` -- `'use client'` component that loads the YouTube IFrame API and handles campus switching.

##### 1.4 YouTube Sync Job

**Modified file:** `payload.config.ts` -- add new task:

```typescript
{
  slug: 'youtubeSync',
  retries: 2,
  queue: 'pipeline',
  inputSchema: [],
  outputSchema: [
    { name: 'matched', type: 'number' },
    { name: 'unmatched', type: 'number' },
    { name: 'errors', type: 'number' },
  ],
  handler: async ({ req }) => {
    const { runYouTubeSync } = await import('@/pipeline/youtube-sync-runner')
    return { output: await runYouTubeSync(req.payload) }
  },
}
```

**New file:** `src/pipeline/youtube-sync-runner.ts` -- orchestrates fetch, match, and update.

**Cron schedule:** Run daily (e.g., `0 6 * * 1` -- Monday 6am) since sermons are weekly. More frequent runs waste quota without benefit.

**Cache invalidation:** Call `revalidateTag('sermons', 'default')` after updates (Next.js 16 requires the second `'default'` argument).

##### Phase 1 Deliverables

- [ ] `src/lib/youtube-api.ts` -- YouTube Data API v3 client
- [ ] `src/pipeline/youtube-matcher.ts` -- matching logic
- [ ] `src/pipeline/youtube-sync-runner.ts` -- sync orchestrator
- [ ] Schema changes to Sermons collection (videos array, pipeline fields)
- [ ] Database migration via `payload migrate:create`
- [ ] `src/components/media/SermonVideoPlayer.tsx` -- client component
- [ ] Updated `src/app/(frontend)/sermons/[slug]/page.tsx` with video section
- [ ] New task in `payload.config.ts` with separate `pipeline` queue
- [ ] Environment variables: `YOUTUBE_API_KEY`, channel IDs
- [ ] Add new cache tag `sermonPipeline` to `src/lib/cache-tags.ts`

---

#### Phase 2: Transcription & Smart Player

**R6, R7, R8, R9, R10** (see origin)

##### 2.1 YouTube Transcript Fetcher

**New file:** `src/pipeline/youtube-transcript.ts`

**New dependency:** `youtube-transcript` (lightweight, no auth needed)

**Pivot note:** Originally planned to scrape Sunflower AI transcripts via Playwright, but Sunflower AI transcripts proved unreliable to access programmatically. YouTube auto-generated captions provide equivalent timestamped transcript data without the scraping complexity or 400MB Chromium dependency.

Approach:
1. For each video-matched sermon, take the first YouTube video ID
2. Fetch auto-generated English captions via the `youtube-transcript` package
3. Format transcript with timestamp markers every ~30 seconds for boundary detection
4. Store formatted transcript in Sermons `transcript` textarea field

**Resilience strategy:**
- If captions are disabled or unavailable, mark sermon as `failed` with descriptive error
- Retry up to 1 time via Payload job retry mechanism
- Process up to 10 sermons per run to avoid rate limiting

**Orchestrator:** `src/pipeline/transcript-sync-runner.ts` handles the full flow: fetch transcript, run boundary detection, update sermon record

##### 2.2 Sermon Boundary Detection

**New file:** `src/pipeline/boundary-detector.ts`

Use Claude Haiku 4.5 to analyze the transcript and identify sermon boundaries. This is more robust than heuristic pattern matching because service formats vary.

```typescript
const BoundarySchema = z.object({
  sermonStartSeconds: z.number().describe('Timestamp in seconds where the sermon begins (after Bible reading handoff)'),
  sermonEndSeconds: z.number().describe('Timestamp in seconds where the sermon ends (after closing prayer, before next service item)'),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string().describe('Brief explanation of why these boundaries were chosen'),
})
```

System prompt instructs the model to look for:
- Bible passage reading handoff to the speaker (sermon start)
- Speaker's closing prayer -- specifically the **second** prayer, not the opening one (sermon end)
- The transition to the next service item (confirmation of end)

**Failure handling:**
- `confidence: 'low'` -- save timestamps but set `boundariesConfirmed: false`, flag for manual review, do NOT proceed to Phase 3
- `confidence: 'medium'` or `'high'` -- save timestamps, set `boundariesAutoDetected: true`, proceed to Phase 3
- API error or no discernible boundaries -- set `pipelineStatus: 'failed'`, store error

**Token cost:** ~10,000 input tokens (transcript) + ~200 output tokens. ~$0.01 per sermon with Haiku 4.5.

##### 2.3 Custom Video Player

**Approach decision:** Use the **YouTube IFrame Player API** with a custom React wrapper rather than Video.js.

**Rationale:** Video.js cannot natively play YouTube videos. The `videojs-youtube` plugin is unmaintained for v8. The YouTube IFrame Player API provides programmatic control (seek, currentTime, duration) which is sufficient to build a segment-clipped player.

**New client component:** `src/components/media/SermonSegmentPlayer.tsx`

Behavior:
- Loads YouTube IFrame Player API
- On `onReady`: seek to `sermonStartSeconds`
- On `onStateChange`: if `currentTime >= sermonEndSeconds`, pause
- Custom progress bar overlay showing `0` to `(endSeconds - startSeconds)` as the full range
- Time display shows `currentTime - startSeconds` (so the viewer sees "0:00" at sermon start)
- Seek interactions map to the `[startSeconds, endSeconds]` range only
- If no boundaries set, falls back to standard YouTube embed (full video)

This replaces the simpler `SermonVideoPlayer.tsx` from Phase 1, or extends it.

##### 2.4 Transcript Scraping Job

**New task in `payload.config.ts`:**

```typescript
{
  slug: 'transcriptScrape',
  retries: 3,
  queue: 'pipeline',
  handler: async ({ req }) => {
    const { runTranscriptScrape } = await import('@/pipeline/transcript-scrape-runner')
    return { output: await runTranscriptScrape(req.payload) }
  },
}
```

**Cron schedule:** Run Monday morning after YouTube sync. Transcripts may not be available immediately after Sunday's service -- allow ~12 hours.

##### Phase 2 Deliverables

- [x] `src/pipeline/youtube-transcript.ts` -- YouTube caption fetcher
- [x] `src/pipeline/boundary-detector.ts` -- AI-assisted boundary detection
- [x] `src/pipeline/transcript-sync-runner.ts` -- orchestrator
- [x] `src/app/api/pipeline/transcript-sync/route.ts` -- API endpoint
- [x] New Payload task `transcriptSync`
- [x] `src/components/media/SermonSegmentPlayer.tsx` -- VideoJS 8 + videojs-youtube with custom progress bar
- [x] Sermon detail page uses segment player when boundaries are set, falls back to simple player
- [x] `@anthropic-ai/sdk` dependency added (shared with Phase 3)
- [x] `youtube-transcript` dependency added

---

#### Phase 3: AI Content Generation

**R11, R12, R13, R14, R15, R16, R17, R18, R19, R20** (see origin)

##### 3.1 CSB Bible Dataset

**New file:** `src/lib/bible-lookup.ts`

**Data source:** Check [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) for CSB availability. If CSB is not available in open datasets (likely due to copyright), use [API.Bible](https://scripture.api.bible/) which hosts the CSB.

**Approach:**
- Primary: API.Bible REST API for CSB verse lookup (free API key for church use)
- Fallback: If API.Bible is unavailable, gracefully degrade by omitting full verse text and showing only the reference
- Cache fetched verses locally (in a `bible-verses` Payload collection or JSON file) to avoid repeated API calls for commonly referenced passages

**Attribution:** Every scripture quote must include: *"Scripture quotations marked CSB have been taken from the Christian Standard Bible, Copyright 2017 by Holman Bible Publishers. Used by permission."*

**Environment variables:** `BIBLE_API_KEY`

##### 3.2 AI Blog Content Generator

**New file:** `src/pipeline/blog-generator.ts`

**New dependency:** `@anthropic-ai/sdk`, `zod` (already in project via Payload)

Use Claude Haiku 4.5 (`claude-haiku-4-5`) with Zod structured output:

```typescript
const SermonBlogSchema = z.object({
  title: z.string().describe('Engaging blog post title derived from the sermon'),
  summary: z.string().describe('2-4 paragraph engaging summary of the sermon message'),
  reflectionQuestions: z.array(z.string()).describe('3-6 reflection questions drawn directly from the sermon content, not invented'),
  scriptureReferences: z.array(z.object({
    reference: z.string().describe('Book chapter:verse format, e.g., John 3:16-17'),
    context: z.string().describe('How this passage was referenced in the sermon'),
  })),
  excerpt: z.string().describe('1-2 sentence excerpt for the blog listing page'),
})
```

**System prompt design** (grounded generation per R13):
- "You are summarizing a sermon transcript for Ev Church. Only reference ideas, scriptures, and themes explicitly present in the transcript."
- "Do not introduce theological concepts, illustrations, or scripture references the speaker did not mention."
- "Reflection questions must come from questions the speaker actually raised or implied, not generic study questions."
- "Never use em dashes in your output." (per user feedback memory)

**Token budget:** ~10,000 input + ~2,000 output per sermon = ~$0.02 with Haiku 4.5. At one sermon/week, monthly cost is under $0.10.

##### 3.3 Blog Post Assembly & Publishing

**New file:** `src/pipeline/blog-publisher.ts`

Pipeline:
1. Receive structured output from `blog-generator.ts`
2. For each scripture reference, look up full CSB text via `bible-lookup.ts`
3. Assemble the blog post content as Lexical JSON using `convertMarkdownToLexical` from `@payloadcms/richtext-lexical`
4. Blog post structure:
   - AI disclosure notice (prominent, at the top)
   - Engaging summary
   - Scripture passages as blockquotes with CSB text and attribution
   - Reflection questions as a numbered list
   - Cross-link to the sermon video/audio page
5. Create the BlogPost via Payload Local API with `_status: 'published'` (auto-publish per origin decision)
6. Update the Sermon record with the `blogPost` relationship and populate `summary`, `discussionQuestions`, `enrichedScripture` fields
7. Call `revalidateTag('blogPosts', 'default')` and `revalidateTag('sermons', 'default')`

**Quality gates before auto-publishing:**
- Summary length > 200 characters
- At least 2 reflection questions present
- All scripture references resolve in the CSB dataset (or gracefully degrade to reference-only)
- If any gate fails: save as draft (`_status: 'draft'`), set `pipelineStatus: 'failed'` with reason

**Blog post field mapping:**
- `title`: Generated title
- `slug`: Kebab-cased from title, collision-checked
- `author`: Speaker's name (from Sermons.speakers relationship)
- `publishedDate`: Sermon's `publishedAt` date
- `featuredImage`: Reuse the sermon series' `bannerImage` or `backgroundImage`
- `sermon`: Relationship to the source Sermon
- `sermonSeries`: Copy from the source Sermon's series
- `isAiGenerated`: `true`
- `content`: Lexical JSON with full blog content
- `excerpt`: Generated excerpt
- `seo.metaTitle`: Generated title
- `seo.metaDescription`: Generated excerpt

##### 3.4 Cross-Linking (R17)

**Sermon detail page** (`src/app/(frontend)/sermons/[slug]/page.tsx`):
- If `blogPost` relationship is populated, show "Read the blog post" link

**Blog detail page** (`src/app/(frontend)/blog/[slug]/page.tsx`):
- If `sermon` relationship is populated, show "Watch/listen to the sermon" link
- **This page needs to be fully implemented first** -- it is currently a hardcoded placeholder

**Orphan prevention:**
- Add an `afterChange` hook on Sermons: when `isPublished` changes to `false`, also unpublish the linked blog post
- Cross-links render conditionally: only show if the linked document exists and is published

##### 3.5 Blog Detail Page Implementation

**Modified file:** `src/app/(frontend)/blog/[slug]/page.tsx`

This page is currently a placeholder with hardcoded Lorem Ipsum. Before AI blog posts can display, it must be rewritten to:
1. Query the `blog-posts` collection by slug with `depth: 1`
2. Handle draft/published status (404 for unpublished when not previewing)
3. Render Lexical rich text content using the existing `RichTextRenderer`
4. Display author, date, featured image, sermon series link
5. For AI-generated posts: render the `aiDisclosure` prominently
6. Show cross-link to sermon page when `sermon` relationship exists
7. Generate structured data (JSON-LD `Article` schema) for SEO
8. Generate metadata for Open Graph

##### 3.6 AI Generation Job

**New task in `payload.config.ts`:**

```typescript
{
  slug: 'blogGenerate',
  retries: 2,
  queue: 'pipeline',
  handler: async ({ req }) => {
    const { runBlogGeneration } = await import('@/pipeline/blog-generate-runner')
    return { output: await runBlogGeneration(req.payload) }
  },
}
```

**Cron schedule:** Run after transcript scraping + boundary detection complete. Could be same day or next day depending on transcript availability.

##### 3.7 Pipeline Management Admin View

**New file:** `src/app/(payload)/admin/pipeline/page.tsx` (Payload custom admin view)

Features:
- Table of recent sermons with pipeline status (color-coded)
- Per-sermon: show which phases are complete, pending, or failed
- Error messages for failed steps
- "Re-trigger" button per phase per sermon
- Anthropic API token usage summary (track input/output tokens per generation, store on Sermon or in a separate `pipeline-runs` collection)
- Manual YouTube video association (for unmatched videos)
- Manual transcript upload fallback (paste text into the sermon's transcript field)

**Token tracking approach:** Store per-generation token counts on the Sermon record (`aiInputTokens`, `aiOutputTokens` number fields). The admin view aggregates these for monthly totals. No hard budget cap initially -- just visibility. Add a warning threshold in `SiteSettings` global if desired later.

Also unhide the Payload jobs collection for admin visibility:

```typescript
jobsCollectionOverrides: ({ defaultJobsCollection }) => ({
  ...defaultJobsCollection,
  admin: { ...defaultJobsCollection.admin, hidden: false },
})
```

##### Phase 3 Deliverables

- [ ] `src/lib/bible-lookup.ts` -- CSB verse lookup
- [ ] `src/pipeline/blog-generator.ts` -- AI content generation with Zod structured output
- [ ] `src/pipeline/blog-publisher.ts` -- assembly, quality gates, publishing
- [ ] `src/pipeline/blog-generate-runner.ts` -- orchestrator
- [ ] Schema changes to BlogPosts (sermon, isAiGenerated, aiDisclosure fields)
- [ ] Database migration
- [ ] Rewrite `src/app/(frontend)/blog/[slug]/page.tsx` -- full implementation
- [ ] Update `src/app/(frontend)/blog/page.tsx` -- listing page wired to collection
- [ ] Cross-link sections on sermon detail and blog detail pages
- [ ] `afterChange` hook on Sermons for orphan prevention
- [ ] New Payload task `blogGenerate`
- [ ] Pipeline admin view in Payload
- [ ] Unhide jobs collection
- [ ] AI token tracking fields on Sermons
- [ ] CSB attribution on all scripture quotes
- [ ] Environment variables: `ANTHROPIC_API_KEY`, `BIBLE_API_KEY`

---

### Job Queue Architecture

Create a separate `pipeline` queue to avoid competing with the existing 15-minute sermon sync:

```typescript
// payload.config.ts
jobs: {
  tasks: [
    // Existing
    { slug: 'fullSermonSync', /* ... */ },
    // New
    { slug: 'youtubeSync', queue: 'pipeline', /* ... */ },
    { slug: 'transcriptScrape', queue: 'pipeline', /* ... */ },
    { slug: 'blogGenerate', queue: 'pipeline', /* ... */ },
  ],
  autoRun: [
    { cron: '*/15 * * * *', queue: 'default', limit: 10 },   // existing
    { cron: '0 6 * * 1', queue: 'pipeline', limit: 5 },       // pipeline: Monday 6am
  ],
}
```

The pipeline queue runs weekly on Monday mornings. Individual tasks can also be triggered manually from the admin view or via API endpoints.

**Pipeline orchestration:** Tasks run in dependency order within the queue. The `youtubeSync` task processes all sermons, then `transcriptScrape` processes sermons with `pipelineStatus: 'video-matched'`, then `blogGenerate` processes sermons with `pipelineStatus: 'boundaries-set'`. Each task advances the `pipelineStatus` field, creating a natural state machine.

### New API Endpoints

```
POST /api/pipeline/youtube-sync    -- Trigger YouTube sync (CRON_SECRET protected)
POST /api/pipeline/transcript      -- Trigger transcript scraping (CRON_SECRET protected)
POST /api/pipeline/generate        -- Trigger blog generation (CRON_SECRET protected)
POST /api/pipeline/trigger-all     -- Run full pipeline (CRON_SECRET protected)
```

Following the existing pattern in `src/app/api/sync/sermons/route.ts`.

## System-Wide Impact

### Interaction Graph

- YouTube sync updates Sermons collection -> triggers `revalidateTag('sermons', 'default')` -> ISR rebuilds sermon pages
- Blog generation creates BlogPosts + updates Sermons -> triggers `revalidateTag('blogPosts', 'default')` + `revalidateTag('sermons', 'default')` -> ISR rebuilds both
- Sermon soft-delete (`isPublished: false`) via existing sync -> `afterChange` hook unpublishes linked blog post -> triggers blog revalidation
- Pipeline status changes on Sermons are admin-only visibility (no frontend rendering of pipeline state)

### Error Propagation

- YouTube API errors: Retried 2x by Payload job queue, then marked `failed` with error message. Does not block other sermons.
- YouTube transcript errors: Retried 1x by Payload job queue. Captions disabled/unavailable is per-sermon failure. Does not block other sermons.
- Anthropic API errors: Retried 2x. Rate limit errors use exponential backoff. Refusal responses (unlikely but possible) marked as `failed`.
- CSB lookup failures: Graceful degradation -- show reference without full text. Does not block blog publishing.
- Lexical JSON assembly errors: Catch and save as draft with error message.

### State Lifecycle Risks

- **Partial pipeline failure**: Each phase advances `pipelineStatus` independently. A sermon can have video but no transcript, or transcript but no blog post. This is by design (phased delivery).
- **Orphaned blog posts**: Handled by `afterChange` hook on Sermons. When `isPublished` flips to false, linked blog post is also unpublished.
- **Stale transcripts**: If YouTube updates auto-generated captions (e.g., improved speech recognition), the blog post would need regeneration. The admin "re-trigger" button handles this.
- **Concurrent job execution**: Payload job queue processes jobs sequentially within a queue. No race conditions between pipeline steps for the same sermon.

### API Surface Parity

- Sermon detail page gains video player + blog post cross-link
- Blog detail page gains sermon cross-link + AI disclosure
- Blog listing page needs to be wired up to the collection (currently placeholder)
- No new public API endpoints (pipeline endpoints are all CRON_SECRET protected)

## Acceptance Criteria

### Functional Requirements

#### Phase 1
- [ ] YouTube videos from Central and North channels are automatically fetched and matched to sermon records
- [ ] Sermon detail page shows campus video choice (Central/North) alongside audio player
- [ ] When only one campus has video, it displays without a broken selector
- [ ] Non-sermon videos (< 30 min, non-Sunday) are filtered out
- [ ] Unmatched videos are logged but don't cause errors

#### Phase 2
- [ ] YouTube auto-generated captions are fetched and stored on sermon records
- [ ] Sermon boundaries (start/end seconds) are auto-detected from transcripts
- [ ] Team members can manually adjust timestamps in Payload admin
- [ ] Video player shows only the sermon segment with accurate progress bar
- [ ] Player falls back to full video when no boundaries are set
- [ ] Low-confidence boundary detection flags for manual review

#### Phase 3
- [ ] AI-generated blog posts contain: summary, reflection questions, CSB scripture quotes
- [ ] Generated content stays faithful to the sermon transcript (no invented theology)
- [ ] Reflection questions are drawn from the sermon, not generic
- [ ] Blog posts auto-publish with `_status: 'published'`
- [ ] Posts failing quality gates save as drafts instead
- [ ] AI disclosure notice is prominent on every AI-generated post
- [ ] CSB attribution appears on every scripture quote
- [ ] Sermon pages link to blog posts and vice versa
- [ ] Cross-links only render when the linked document is published
- [ ] Pipeline status is visible per-sermon in Payload admin
- [ ] Failed steps can be re-triggered from admin
- [ ] Token usage is tracked and visible in admin
- [ ] Blog detail page (`/blog/[slug]`) is fully implemented with Lexical rendering

### Non-Functional Requirements

- [ ] Pipeline runs on cron without manual intervention
- [ ] YouTube API usage stays well under 10,000 daily quota
- [ ] Anthropic API cost per sermon < $0.10
- [ ] YouTube transcript fetcher handles captions-disabled gracefully
- [ ] Database migrations created for all schema changes
- [ ] No `any` types in new code
- [ ] Cache invalidation fires correctly after all data updates

## Success Metrics

- Users can watch sermon video on the website within 24 hours of the Sunday service
- AI blog posts are published within 48 hours of the service with < 10% requiring manual edits
- Two indexed pages per sermon (sermon + blog post) increase organic search impressions
- Pipeline runs with < 5% failure rate over a 4-week period
- Zero instances of AI-generated content contradicting the sermon source material

## Dependencies & Prerequisites

- **YouTube Data API key** (Google Cloud Console)
- **Anthropic API key** with sufficient token budget (~$0.50/month at weekly sermons)
- **API.Bible API key** for CSB text (or alternative CSB dataset source)
- **Campuses collection** already exists with Central and North campus records
- **Blog detail page** must be implemented before Phase 3 ships

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| YouTube disables auto-captions on livestreams | Very Low | High | Manual transcript upload fallback in admin |
| YouTube API quota exceeded | Very Low | Medium | Using efficient endpoints (2-3 units/sync vs 100 for search) |
| AI generates unfaithful content | Low | High | Grounded system prompt, quality gates, auto-publish saves as draft on failure |
| CSB dataset unavailable | Low | Medium | Fallback to reference-only (no full text), investigate API.Bible |
| Playwright too heavy for Railway | Medium | Medium | Consider separate scraper service, or switch to lighter HTTP-based approach if possible |
| Sermon boundary detection unreliable | Medium | Medium | Manual override in admin, low-confidence threshold flags for review |
| Blog detail page implementation delays Phase 3 | Medium | Low | Blog page is a prerequisite; implement early in Phase 3 |

## Future Considerations

- **Sermon search powered by transcript content** (deferred per origin): Once transcripts are stored, full-text search across sermons becomes feasible
- **Automated social media snippets**: Generate social-friendly excerpts from the blog content
- **Multi-language support**: If YouTube provides multi-language auto-captions, blog posts could be generated in multiple languages
- **Sermon chapters/timestamps**: Display key moments within the sermon as clickable chapters
- **Listener analytics**: Track which sermons/blog posts get the most engagement

## Documentation Plan

- Add pipeline environment variables to project README/setup docs
- Document the pipeline admin workflow for the content team
- Document the YouTube transcript fetcher for maintenance

## Sources & References

### Origin

- **Origin document:** [docs/brainstorms/2026-04-05-sermon-content-pipeline-requirements.md](docs/brainstorms/2026-04-05-sermon-content-pipeline-requirements.md) -- Key decisions carried forward: phased delivery, YouTube supplements resources.ev.church, auto-publish with edit-after, CSB translation, AI transparency disclosure, cross-linked pages for SEO

### Internal References

- Sermon sync pattern: `src/sync/sermon-sync-runner.ts`
- Rock API client pattern: `src/lib/rock-api.ts`
- Payload job queue config: `payload.config.ts:105-130`
- Sermons collection: `src/collections/Sermons.ts`
- BlogPosts collection: `src/collections/BlogPosts.ts`
- Blog detail page (placeholder): `src/app/(frontend)/blog/[slug]/page.tsx`
- Sermon detail page: `src/app/(frontend)/sermons/[slug]/page.tsx`
- Cache tags: `src/lib/cache-tags.ts`
- RichTextRenderer: `src/components/blocks/RichTextRenderer.tsx`
- Existing Video block: `src/blocks/VideoBlock.ts`

### External References

- [YouTube Data API v3 docs](https://developers.google.com/youtube/v3/docs)
- [YouTube API Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)
- [Playwright Docker guide](https://playwright.dev/docs/docker)
- [Anthropic API structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [CSB Permissions](https://csbible.com/permissions/)
- [API.Bible](https://scripture.api.bible/)
- [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases)
- [Lexical serialization docs](https://lexical.dev/docs/concepts/serialization)
- [Payload CMS Jobs Queue docs](https://payloadcms.com/docs/jobs-queue/tasks)
