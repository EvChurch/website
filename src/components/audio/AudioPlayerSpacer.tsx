'use client'

import { useAudioPlayer } from './AudioPlayerProvider'

export function AudioPlayerSpacer() {
  const { currentSermon } = useAudioPlayer()
  if (!currentSermon) return null
  // Match the height of the AudioPlayerBar (progress bar + controls)
  return <div className="h-[72px]" aria-hidden />
}
