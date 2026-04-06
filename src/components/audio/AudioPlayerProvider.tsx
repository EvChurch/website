'use client'

/**
 * Backwards-compatibility shim.
 * All media playback is now managed by MediaPlayerProvider.
 * This file re-exports the types and hooks that existing consumers import.
 */

export { MediaPlayerProvider as AudioPlayerProvider, useMediaPlayer as useAudioPlayer } from '@/components/media/MediaPlayerProvider'
export type { SermonMedia as SermonAudio } from '@/components/media/MediaPlayerProvider'
export type { ListeningRecord } from '@/lib/listening-store'
