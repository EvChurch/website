---
title: "feat: Unified media player with video/audio split button and expandable overlay"
type: feat
status: active
date: 2026-04-06
origin: docs/brainstorms/2026-04-06-unified-media-player-requirements.md
---

# Unified Media Player

## Overview

Transform the bottom audio bar into a universal media player that handles both audio and YouTube video playback. Every play button across the site becomes a split button with a dropdown for choosing between audio and per-campus video options. Video plays in an expandable overlay that can be minimized to the bar without interrupting playback. The user's media preference (audio or a specific campus video) persists across sessions.

## Problem Statement / Motivation

Sermon playback is split between two disconnected systems: an audio bottom bar and a standalone video player only accessible on the sermon detail page. Users who prefer video cannot start playback from listing pages. There's no way for the system to remember preferences, so every session starts from scratch. (see origin: `docs/brainstorms/2026-04-06-unified-media-player-requirements.md`)

## Proposed Solution

Replace `AudioPlayerProvider` with a unified `MediaPlayerProvider` that manages both an `HTMLAudioElement` and a video.js YouTube player behind a single interface. The existing bottom bar gains a video thumbnail when playing video, and a fixed-position video container enables CSS-based resize between bar-thumbnail and expanded-overlay states without iframe reload.

## Technical Approach

### Architecture

**Component Tree (in layout.tsx):**

```
AudioPlayerProvider  ->  MediaPlayerProvider
  ├── Header
  ├── main (children / pages)
  ├── Footer
  ├── AudioPlayerSpacer  ->  MediaPlayerSpacer
  ├── AudioPlayerBar  ->  MediaPlayerBar
  └── [NEW] VideoContainer (fixed-position, CSS-resized)
```

**State Model:**

The `MediaPlayerProvider` exposes a unified interface:

```typescript
interface MediaPlayerState {
  // Current media
  currentSermon: SermonMedia | null
  mediaType: 'audio' | 'video'
  // Playback state
  isPlaying: boolean
  isLoading: boolean
  progress: number
  duration: number
  playbackSpeed: number
  // Video-specific
  isVideoExpanded: boolean
  // Actions
  play: (sermon: SermonMedia, mediaType?: 'audio' | 'video', campusSlug?: string) => void
  pause: () => void
  resume: () => void
  seek: (time: number) => void
  setSpeed: (speed: number) => void
  skipForward: () => void
  skipBack: () => void
  close: () => void
  expandVideo: () => void
  minimizeVideo: () => void
}
```

Where `SermonMedia` extends the existing `SermonAudio` with optional video data:

```typescript
interface SermonMedia extends SermonAudio {
  videos?: {
    campusName: string
    campusSlug: string
    youtubeVideoId: string
    startSeconds?: number
    endSeconds?: number
  }[]
}
```

**Video Container Strategy:**

The YouTube iframe lives in a single fixed-position DOM container (`VideoContainer`). Two CSS states:

1. **Expanded:** `fixed inset-0 z-50` with dark backdrop, video centered at `max-w-5xl` (80vw desktop, ~95vw mobile)
2. **Minimized:** `fixed bottom-[bar-height] right-4 w-48 h-27 z-40` (16:9 thumbnail in bar corner)

Transitions via CSS `transition: all 300ms ease-out`. The iframe never leaves the DOM, never reloads.

**Preference Storage:**

Extend the existing Zustand listening store:

```typescript
// Added to listening-store.ts state
mediaPreference: 'audio' | { type: 'video'; campusSlug: string }
setMediaPreference: (pref: MediaPreference) => void
```

Default for new users: `'audio'` (see origin: R2 fallback behavior).

Persisted via the existing `partialize` config. Preference is NOT updated on silent fallback.

### Implementation Phases

#### Phase 1: MediaPlayerProvider + Preference Store

Foundation phase. Replace AudioPlayerProvider with MediaPlayerProvider that handles both audio and video behind a unified interface.

**Tasks:**

- [ ] Add `mediaPreference` field to `src/lib/listening-store.ts` with `'audio'` default, include in `partialize`
- [ ] Create `src/components/media/MediaPlayerProvider.tsx` with the unified `MediaPlayerState` interface
  - Audio path: reuse existing `HTMLAudioElement` logic from `AudioPlayerProvider`
  - Video path: manage a video.js player instance (lazy-initialized on first video play)
  - `play()` method: reads preference from store, resolves which media to play, stops previous source, starts new one
  - `close()`: pauses and hides video (does not dispose player), clears audio src
  - Save audio progress before switching sources (existing behavior preserved)
  - Single playback guarantee: starting audio pauses video.js, starting video pauses HTMLAudioElement
- [ ] Create `src/components/media/VideoContainer.tsx` - fixed-position container for the video.js player
  - Two CSS states: expanded (overlay) and minimized (bar thumbnail)
  - Dark backdrop with click-to-minimize
  - Minimize button in expanded state
  - Expand button in minimized state
  - Auto-minimize on route change (listen to `usePathname()`)
  - Responsive: ~95% width on mobile (`sm:`), 80% (`max-w-5xl`) on desktop
- [ ] Update `src/app/(frontend)/layout.tsx` to use `MediaPlayerProvider` instead of `AudioPlayerProvider`, add `VideoContainer`
- [ ] Create `src/components/media/VideoControls.tsx` - extracted from `VideoPlayerInner.tsx` lines 269-391
  - Props: all the handler callbacks + state values
  - Two modes: `full` (expanded overlay) and `compact` (bar thumbnail - play/pause + thin progress bar only)
  - Hide YouTube native controls via `controls: 0`, `ytControls: 0` params
- [ ] Shared playback speed between audio and video (read from Zustand store)
- [ ] Media Session API: set metadata for both audio and video; action handlers target whichever is active

**Success criteria:** Can programmatically `play(sermon, 'audio')` and `play(sermon, 'video', 'north')` and the correct player starts. Switching stops the other. Video appears in fixed container.

#### Phase 2: Split Play Button + Dropdown

Replace all play buttons with the unified split button that offers media choice.

**Tasks:**

- [ ] Create `src/components/media/MediaPlayButton.tsx` - split button component
  - Main area: circular play button with progress ring (reuse existing ring logic from `PlayButton`)
  - Chevron area: opens dropdown popover
  - Dropdown lists: "Audio" + per-campus video options from sermon data
  - Main button uses stored `mediaPreference`, falls back to audio silently
  - Selecting from dropdown: plays immediately AND updates stored preference
  - Sizes: `sm`, `md`, `lg` (matching existing `PlayButton`)
  - Chevron tap target: minimum 44x44px on mobile
  - Dropdown rendered as portal to avoid card overflow clipping
- [ ] Create `src/components/media/MediaPlayIcon.tsx` - inline icon variant with split dropdown for text buttons
  - Used by `SermonPlayButton`, `SermonHeroClient`, `LatestSermonPlayButton`
  - Shows text like "Listen Now" or "Watch North" based on preference
  - Chevron/dropdown for switching
- [ ] Update `src/components/sermons/SermonCard.tsx`
  - Add `videos` prop (array of `{ campusName, campusSlug, youtubeVideoId, startSeconds?, endSeconds? }`)
  - Replace `PlayButton` with `MediaPlayButton`
  - Pass video options for the dropdown
- [ ] Update `src/app/(frontend)/sermons/[slug]/SermonPlayButton.tsx` to use `MediaPlayIcon`
- [ ] Update `src/app/(frontend)/sermons/SermonHeroClient.tsx` to use `MediaPlayIcon`
- [ ] Update `src/components/blocks/LatestSermonPlayButton.tsx` to use `MediaPlayIcon`
- [ ] Update `src/components/sermons/ContinueListening.tsx` to use `MediaPlayButton`

**Data flow for listings:**

All listing pages already fetch at `depth: 2`. Need to pass video data through to cards:

- [ ] Add `sermonHasVideo()` and `getSermonVideos()` helpers to `src/lib/sermon-utils.ts`
- [ ] Update sermon listing pages (5 files) to pass `videos` prop to `SermonCard`:
  - `src/app/(frontend)/sermons/page.tsx`
  - `src/app/(frontend)/sermons/series/[slug]/page.tsx`
  - `src/app/(frontend)/sermons/speakers/[slug]/page.tsx`
  - `src/app/(frontend)/sermons/scriptures/[slug]/page.tsx`
  - `src/app/(frontend)/sermons/topics/[slug]/page.tsx`

**Success criteria:** Every play button across the site shows a chevron. Tapping the chevron reveals available options. Selecting an option plays it and persists the preference. Next play on a different sermon uses the stored preference.

#### Phase 3: MediaPlayerBar + Remove Standalone Player

Transform the bottom bar to handle video and remove the old standalone video section.

**Tasks:**

- [ ] Rename/refactor `src/components/audio/AudioPlayerBar.tsx` -> `src/components/media/MediaPlayerBar.tsx`
  - When playing audio: identical to current bar (no visual change)
  - When playing video (minimized): show small video thumbnail on the left (the `VideoContainer` positions itself above/beside the bar), simplified controls (play/pause, progress, expand button)
  - Adjust swipe-to-dismiss to work for both audio and video (closes player entirely)
  - Expand button: calls `expandVideo()` from provider
- [ ] Update `src/components/audio/AudioPlayerSpacer.tsx` -> `src/components/media/MediaPlayerSpacer.tsx`
  - Height adjusts based on whether video thumbnail is visible in bar (slightly taller)
- [ ] Remove standalone video player from sermon detail page
  - Remove the `{/* Video player section */}` block from `src/app/(frontend)/sermons/[slug]/page.tsx`
  - Remove import of `VideoPlayer`
- [ ] Deprecate/remove old components:
  - `src/components/media/VideoPlayer.tsx` (thumbnail wrapper - no longer needed)
  - `src/components/media/SermonVideoPlayer.tsx` (iframe-only player - superseded)
  - `src/components/audio/AudioPlayerProvider.tsx` (replaced by MediaPlayerProvider)
  - `src/components/audio/AudioPlayerBar.tsx` (replaced by MediaPlayerBar)
  - `src/components/audio/PlayButton.tsx` (replaced by MediaPlayButton)
  - `src/components/audio/PlayIcon.tsx` (replaced by MediaPlayIcon)
- [ ] Keep `src/components/media/VideoPlayerInner.tsx` but refactor: remove its JSX controls overlay (now in `VideoControls.tsx`), export only the player initialization logic for use by `MediaPlayerProvider`
- [ ] Update all imports across the codebase

**Success criteria:** The sermon detail page has no video section. Video plays exclusively through the bar/overlay. Old components are removed. The bottom bar shows video thumbnail when video is playing.

## System-Wide Impact

### Interaction Graph

`MediaPlayButton.click()` -> reads `mediaPreference` from Zustand store -> calls `MediaPlayerProvider.play(sermon, type, campus)` -> provider saves current progress (if switching) -> stops previous source (audio.pause() or videojs.pause()) -> starts new source -> updates `currentSermon` state -> `MediaPlayerBar` re-renders with new sermon info -> if video: `VideoContainer` becomes visible (expanded or minimized based on R6) -> Media Session API updates lock screen metadata

### Error Propagation

- YouTube iframe load failure: video.js fires `error` event -> provider sets `isLoading: false` -> bar shows error state or falls back to audio
- Audio stream 404: existing error handling in AudioPlayerProvider carries over
- No retry conflicts: audio and video are mutually exclusive, only one source active

### State Lifecycle Risks

- **Partial switch:** If audio stops but video fails to start, user has silence. Mitigation: don't clear audio src until video `playing` event fires.
- **Orphaned video.js instance:** If provider unmounts without disposing player, iframe leaks. Mitigation: dispose in cleanup effect.
- **Stale preference:** User picks "North Video" but North campus is later removed. Mitigation: silent fallback to audio (R2).

### API Surface Parity

All four play button components (`PlayButton`, `SermonPlayButton`, `SermonHeroClient`, `LatestSermonPlayButton`) need identical changes. Consolidating into `MediaPlayButton` + `MediaPlayIcon` ensures parity.

### Integration Test Scenarios

1. Play audio on sermon A -> play video on sermon B -> verify audio stopped, video playing, progress saved for A
2. Expand video overlay -> navigate to new page -> verify overlay auto-minimizes
3. Set preference to "North Video" -> play sermon with no North video -> verify audio plays, preference unchanged
4. Minimize video to bar -> expand -> verify playback position unchanged (no reload)
5. Close video player -> reopen different sermon -> verify preference persists from localStorage

## Acceptance Criteria

### Functional Requirements

- [ ] Split play button with chevron dropdown on all play surfaces (SermonCard, detail hero, listing hero, latest sermon block, continue listening)
- [ ] Dropdown shows "Audio" + per-campus video options (only available options for that sermon)
- [ ] Clicking main button plays with stored preference; selecting from dropdown updates preference
- [ ] Default preference for new users is audio
- [ ] Video plays in expandable overlay (dark backdrop, centered, ~80% viewport / ~95% mobile)
- [ ] Video minimizes to bar thumbnail without playback interruption
- [ ] Expanding from bar returns to overlay without reload
- [ ] Video starts expanded when launched from play button (R6)
- [ ] Video auto-minimizes on client-side navigation
- [ ] Only one media source plays at a time
- [ ] Sermon detail page has no standalone video section
- [ ] Playback speed shared between audio and video
- [ ] Swipe-to-dismiss works for both audio and video in bar
- [ ] Silent fallback to audio when preferred video unavailable (preference unchanged)
- [ ] Progress saved before switching sermons or media types

### Non-Functional Requirements

- [ ] Video minimize/expand transition completes in < 300ms
- [ ] No iframe reload during minimize/expand (verified by checking playback position continuity)
- [ ] Mobile chevron tap target >= 44x44px
- [ ] Dropdown does not clip inside card boundaries (portal rendering)

## Success Metrics

- Users can play video from any sermon listing without page navigation
- Preference system eliminates repeated media selection after first choice
- Zero playback interruption during minimize/expand transitions

## Dependencies & Prerequisites

- Sermons fetched at `depth: 2` on listing pages already include `videos` array with populated campus relationship (verified: listing pages use `depth: 2`)
- `videojs-youtube` plugin supports `controls: 0`, `ytControls: 0` params (verified: already used in current `VideoPlayerInner`)
- Zustand persist middleware supports adding new fields without migration (verified: `partialize` controls what's persisted)

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| YouTube iframe Media Session conflict on mobile | Lock screen shows YouTube metadata instead of sermon info | Test on iOS Safari + Chrome Android early. May need to suppress YouTube's Media Session via iframe sandbox attributes |
| CSS resize transition jank | Choppy minimize/expand | Use `will-change: transform` and test on low-end devices. Fall back to opacity fade if transform is janky |
| video.js bundle size | Increases initial page load | Already lazy-loaded via `next/dynamic`. VideoContainer should also use dynamic import for the player initialization |
| Stale campus data in preference | User's preferred campus renamed/removed | Silent fallback to audio handles this gracefully |

## Sources & References

### Origin

- **Origin document:** [docs/brainstorms/2026-04-06-unified-media-player-requirements.md](docs/brainstorms/2026-04-06-unified-media-player-requirements.md) - Key decisions carried forward: CSS-based resize (not DOM reparenting), split button pattern, expanded by default for video, silent fallback

### Internal References

- Audio provider: `src/components/audio/AudioPlayerProvider.tsx`
- Audio bar: `src/components/audio/AudioPlayerBar.tsx`
- Video player: `src/components/media/VideoPlayerInner.tsx`
- Listening store: `src/lib/listening-store.ts`
- Layout: `src/app/(frontend)/layout.tsx`
- Play button: `src/components/audio/PlayButton.tsx`
- Sermon collection: `src/collections/Sermons.ts` (videos field at line 103)
- Campuses collection: `src/collections/Campuses.ts`

### Key Files to Create

- `src/components/media/MediaPlayerProvider.tsx` - unified provider
- `src/components/media/MediaPlayerBar.tsx` - universal bottom bar
- `src/components/media/MediaPlayerSpacer.tsx` - dynamic spacer
- `src/components/media/VideoContainer.tsx` - fixed-position video container
- `src/components/media/VideoControls.tsx` - extracted controls (full + compact modes)
- `src/components/media/MediaPlayButton.tsx` - split button with dropdown
- `src/components/media/MediaPlayIcon.tsx` - inline icon variant with dropdown

### Key Files to Remove

- `src/components/media/VideoPlayer.tsx` - thumbnail wrapper
- `src/components/media/SermonVideoPlayer.tsx` - iframe-only player
- `src/components/audio/AudioPlayerProvider.tsx` - replaced
- `src/components/audio/AudioPlayerBar.tsx` - replaced
- `src/components/audio/PlayButton.tsx` - replaced
- `src/components/audio/PlayIcon.tsx` - replaced
