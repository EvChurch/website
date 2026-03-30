---
date: 2026-03-29
topic: sermon-library
---

# Sermon Library

## Problem Frame

Ev Church has a rich sermon archive managed through a Rails app at resources.ev.church with a GraphQL API. This content (sermons, series, speakers, topics, scripture references) is not surfaced on the main website. People have no way to discover, browse, or listen to past sermons on ev.church. The existing SermonSeries collection synced from Rock RMS is limited and will be replaced entirely by this new system.

The goal is to build an extraordinary sermon library that makes it effortless for people to find sermons they care about, with an audio-first experience, a persistent Spotify-style player, and an RSS podcast feed generated from our own data.

## Requirements

### Data Model & Sync

- R1. Sync all sermon data from the resources.ev.church GraphQL API into Payload collections: Sermons, Sermon Series, Speakers (authors), Topics, Categories, and Scriptures
- R2. Each synced entity uses the GraphQL UUID as a unique identifier for reconciliation (matching the existing Rock RMS sync pattern)
- R3. Sync series artwork (backgroundUrl, bannerUrl, foregroundUrl) by downloading images into the Media collection
- R4. Sync sermon audio URL (audioUrl) from GraphQL -- store as a URL reference, not the file itself
- R5. Remove the existing SermonSeries collection and its Rock RMS sync logic, replacing it entirely with the new system
- R6. The sermon data model should include fields for future AI-generated content: transcript (text), summary (text), generated discussion questions (richText), and enriched scripture passages (richText) -- all nullable, populated later by an AI pipeline outside this scope
- R7. Sync runs on the same schedule as the existing Rock RMS sync (every 15 minutes via cron)

### Discovery & Browsing

- R8. Sermon library landing page at `/sermons` featuring: hero section with the latest sermon/current series, a browsable Netflix-style grid of sermon series with artwork, and filter/search controls
- R9. Multi-dimensional filtering: by Series, by Speaker, by Topic (grouped under Categories: Theology, Life, Culture, Church), and by Scripture (book of the Bible)
- R10. Filter controls should show item counts per dimension (e.g., "Faith (23)", "Ryan Green (41)") so users can gauge content depth before clicking
- R11. Individual sermon page at `/sermons/[slug]` with audio player, sermon metadata (speaker, date, series, scripture, topics), and navigation to next/previous in series
- R12. Series page at `/sermons/series/[slug]` showing series artwork, description, and all sermons in the series ordered chronologically
- R13. Search functionality that searches across sermon titles, speaker names, series names, topic names, and scripture references
- R14. "No dead ends" -- every sermon page surfaces: next sermon in series, more from this speaker, and related topics

### Audio Player

- R15. Persistent Spotify-style audio player bar that stays visible across all pages while a sermon is playing, showing sermon title, speaker, series, playback controls, and progress
- R16. Audio player supports play/pause, seek, skip forward/back 15 seconds, and playback speed control (1x, 1.25x, 1.5x, 2x)
- R17. Player state persists across page navigation within the session (does not restart when browsing to a new page)

### RSS Podcast Feed

- R20. Generate an RSS/podcast feed at `/sermons/feed.xml` from Payload sermon data, matching the iTunes podcast specification (title, description, author, enclosure with audio URL, duration, pubDate, artwork, categories)
- R21. Feed metadata: title "Ev Church - Sermons", category "Religion & Spirituality > Christianity", language English, copyright Ev Church, owner email info@ev.church
- R22. Include podcast subscribe buttons on the sermon library page linking to Apple Podcasts, Spotify, and the RSS feed URL

### URL Structure

- R23. `/sermons` -- library landing page
- R24. `/sermons/[slug]` -- individual sermon
- R25. `/sermons/series/[slug]` -- series page
- R26. `/sermons/topics/[slug]` -- topic page showing sermons tagged with that topic
- R27. `/sermons/speakers/[slug]` -- speaker page showing all sermons by that speaker
- R28. `/sermons/feed.xml` -- RSS podcast feed

## Success Criteria

- Someone landing on `/sermons` can find and start listening to the latest sermon within 5 seconds
- A visitor looking for a specific topic (e.g., "anxiety", "faith") can filter and find relevant sermons within 2-3 clicks
- The persistent audio player allows listening while browsing the rest of the site without interruption
- The RSS feed validates against Apple Podcasts and Spotify podcast specifications
- Sermon data stays in sync with resources.ev.church within 15 minutes of changes

## Scope Boundaries

- **Out of scope:** AI transcription and content generation pipeline (future phase -- the data model supports it but the pipeline is not built here)
- **Out of scope:** User accounts, saved sermons, listening history, or personalized recommendations
- **Out of scope:** Live streaming integration
- **Out of scope:** Sermon upload/management UI in Payload admin (sermons are synced from the GraphQL API; Payload admin is read-only for sermon data)
- **Out of scope:** Migrating existing podcast subscribers from the resources.ev.church RSS URL to the new feed URL (manual process after launch)

## Key Decisions

- **Audio-only:** The content is audio sermons. Video is not part of the current content pipeline and not in scope.
- **Replace Rock RMS sermon sync:** The GraphQL API at resources.ev.church is the canonical source for all sermon data. The existing SermonSeries collection and Rock sync will be removed.
- **Generate RSS from Payload:** The podcast feed is generated from our own synced data, giving full control over feed contents and metadata. The existing feed at resources.ev.church/resources.rss serves as the reference format.
- **Future AI pipeline ready:** The data model includes nullable fields for transcript, summary, discussion questions, and enriched scripture -- populated by a future AI workflow, not this build.
- **Persistent player:** A Spotify-style audio bar that persists across all pages, not just sermon pages.

## Dependencies / Assumptions

- The GraphQL API audioUrl field is confirmed working. Audio files are M4A hosted via Rails Active Storage on resources.ev.church.
- The simplified API schema has these fields per sermon: name, publishedAt, audioUrl, backgroundUrl, bannerUrl, foregroundUrl, plus relationships to authors, series, topics, scriptures, and connectionScriptures. Previously available fields (snippet, content, sermonNotes, connectGroupNotes, youtubeUrl, videoUrl) have been removed or are unused.
- The GraphQL API pagination uses Relay-style cursor pagination (first/after). All collections support this.
- Series artwork (backgroundUrl, bannerUrl, foregroundUrl) are hosted on resources.ev.church via Rails Active Storage redirect URLs. These need to be downloaded and stored in our Media collection for reliable serving.
- The sermon query supports filtering by authorIds, categoryIds, seriesIds, topicIds, scriptureIds -- useful for validating relationships during sync.

## Outstanding Questions

### Deferred to Planning

- [Affects R15][Technical] What is the best approach for a persistent audio player in Next.js App Router? Likely a client component in the root layout with React context for state management.
- [Affects R3][Technical] Should series artwork be downloaded during sync or lazily on first request? Downloading during sync is more reliable but increases sync time.
- [Affects R8][Needs research] What is the total sermon count? This affects pagination strategy and whether client-side filtering is viable or if server-side filtering is needed.
- [Affects R13][Technical] Should search be Payload's built-in text search or a lightweight client-side search (e.g., Fuse.js) over pre-fetched data?
- [Affects R20][Technical] Should the RSS feed be a static file regenerated on sync, or a dynamic Next.js route that queries Payload on each request (with ISR caching)?

## Next Steps

`/ce:plan` for structured implementation planning
