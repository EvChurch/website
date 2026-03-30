'use client'

import { useAudioPlayer } from './AudioPlayerProvider'

export function AudioPlayerSpacer() {
  const { currentSermon } = useAudioPlayer()
  return (
    <div
      className="bg-warm-white transition-[height] duration-300 ease-out"
      style={{ height: currentSermon ? 80 : 0 }}
      aria-hidden
    />
  )
}
