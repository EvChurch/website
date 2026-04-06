---
date: 2026-04-06
topic: unified-media-player
---

# Unified Media Player

## Problem Frame

Sermon playback is split between two disconnected systems: an audio bottom bar and a standalone video player embedded in the sermon detail page. Users who prefer video have no way to start video playback from listing pages, and switching between audio and video requires navigating to the detail page. There's no way for the system to remember what a user prefers, so every session starts from scratch.

## Requirements

- R1. **Unified play button with split dropdown.** Every play button (SermonCard, sermon detail hero, sermon listing hero) becomes a split button: main area plays with the user's stored preference; a chevron opens a dropdown listing available options ("Audio" plus per-campus video entries like "North Video", "South Video"). Only options available for that specific sermon appear in the dropdown.

- R2. **Persistent playback preference.** The user's last-selected media option (audio or a specific campus video) is stored in localStorage and automatically used for subsequent plays across all sermons. When a sermon lacks the preferred option, fall back to audio silently without notification.

- R3. **Universal media player bar.** The existing bottom audio bar becomes a universal media player. When playing audio, it behaves as today. When playing video, it shows a small video thumbnail in the bar alongside the same controls (play/pause, progress, skip, speed, close). The video iframe lives in a fixed DOM container and is CSS-resized between bar-thumbnail and expanded states so playback is never interrupted.

- R4. **Video expanded overlay.** When video is playing (or when a video-preferring user hits play), the video opens as an expanded overlay: semi-transparent dark backdrop covering the page, video centered at roughly 80% viewport width. The user can minimize it to the bar thumbnail via a minimize button or clicking the backdrop. The page remains scrollable underneath the overlay.

- R5. **Expand from bar.** When video is minimized in the bar, tapping the thumbnail or an expand button returns it to the full overlay without reloading.

- R6. **Play from anywhere starts expanded.** When a user hits play from a listing page and their preference is video, the video starts in the expanded overlay immediately. They can minimize to the bar to continue browsing.

- R7. **Single playback source.** Starting any media (audio or video) stops whatever was previously playing. Only one thing plays at a time.

- R8. **Remove standalone video player.** The current VideoPlayer/VideoPlayerInner components embedded in the sermon detail page are removed. Video playback happens exclusively through the unified bar/overlay system.

- R9. **Custom video controls carry over.** The expanded video overlay uses the same custom controls already built (progress bar, play/pause, volume, speed, fullscreen) with YouTube's native controls hidden. The bar thumbnail state shows minimal controls (play/pause, progress).

## Success Criteria

- A user can play a North campus video from a sermon card in a listing page without navigating away
- After choosing "North Video" once, subsequent plays on any sermon default to North Video
- Minimizing video to the bar and re-expanding does not reload or interrupt playback
- Only one media source plays at any time (starting audio stops video and vice versa)
- The sermon detail page no longer has a separate video section

## Scope Boundaries

- **Not in scope:** Picture-in-picture browser API (we're building our own CSS-based mini-player, not using the native PiP API)
- **Not in scope:** Video progress persistence in listening history (audio progress tracking continues as-is; video watch progress is not saved to localStorage in this phase)
- **Not in scope:** Keyboard shortcuts for the video overlay
- **Not in scope:** Changes to the Payload CMS admin or sermon data model

## Key Decisions

- **CSS-based resize over DOM reparenting:** The YouTube iframe stays in one fixed-position DOM container. Size/position transitions via CSS to avoid iframe reload. This is the only way to get seamless minimize/expand.
- **Split button over long-press:** Chevron split button is discoverable and familiar (GitHub merge button pattern). Long-press would be cleaner but too hidden.
- **Expanded by default for video:** When preference is video, starting playback opens the overlay immediately rather than starting minimized. Users chose video because they want to watch.
- **Silent fallback:** When preferred media isn't available, play audio without interrupting the user with toasts or popups.

## Dependencies / Assumptions

- Sermons fetched at depth 2 already include populated `videos` array with campus names and YouTube IDs
- The `videojs-youtube` plugin supports the YouTube iframe API parameters needed to hide native controls
- The existing listening store Zustand setup can be extended with a `mediaPreference` field

## Outstanding Questions

### Deferred to Planning

- [Affects R3][Technical] How should the fixed video container be structured in the component tree? It needs to live outside the page layout but inside the AudioPlayerProvider (which becomes MediaPlayerProvider). Likely a portal or a sibling to the bar.
- [Affects R9][Technical] Can the existing VideoPlayerInner controls be extracted into a shared component used by both the expanded overlay and the bar thumbnail, or should the bar use simplified controls?
- [Affects R1][Needs research] When sermons are fetched for listing pages, do they currently include the `videos` array? The listing page fetches at `depth: 2` without a `select` clause, so videos should be present, but this needs verification.
- [Affects R3][Technical] Should the MediaPlayerProvider replace AudioPlayerProvider entirely, or wrap it? The provider needs to manage both an HTML Audio element and a video.js player instance.

## Next Steps

-> `/ce:plan` for structured implementation planning
