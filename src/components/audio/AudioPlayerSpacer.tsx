'use client'

import { useAudioPlayer } from './AudioPlayerProvider'

export function AudioPlayerSpacer() {
  const { currentSermon, mediaType } = useAudioPlayer()
  // Only add spacer for audio mode; video uses VideoContainer's own positioning
  const needsSpacer = !!currentSermon && mediaType === 'audio'
  return (
    <div
      className="bg-warm-white transition-[height] duration-300 ease-out"
      style={{ height: needsSpacer ? 80 : 0 }}
      aria-hidden
    />
  )
}
