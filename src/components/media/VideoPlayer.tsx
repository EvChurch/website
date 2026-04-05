'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { VideoSource } from '@/components/media/VideoPlayerInner'

const VideoPlayerInner = dynamic(
  () => import('@/components/media/VideoPlayerInner'),
  { ssr: false },
)

interface VideoPlayerProps {
  videos: VideoSource[]
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function VideoPlayer({ videos }: VideoPlayerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)

  const activeVideo = videos[activeIndex]
  if (!activeVideo) return null

  const startSec = activeVideo.startSeconds ?? 0
  const endSec = activeVideo.endSeconds ?? 0
  const hasSegment = startSec > 0 && endSec > startSec
  const displayDuration = hasSegment ? endSec - startSec : 0

  const handleClickPlay = useCallback(() => {
    setIsLoading(true)
  }, [])

  const handleReady = useCallback(() => {
    setIsReady(true)
    setIsLoading(false)
  }, [])

  const handleCampusSwitch = useCallback(
    (index: number) => {
      if (index === activeIndex) return
      setActiveIndex(index)
      setIsLoading(false)
      setIsReady(false)
    },
    [activeIndex],
  )

  return (
    <div className="w-full">
      {/* Campus selector */}
      {videos.length > 1 && (
        <div className="mb-3 flex gap-2">
          {videos.map((video, index) => (
            <button
              key={video.youtubeVideoId}
              onClick={() => handleCampusSwitch(index)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                index === activeIndex
                  ? 'bg-rich-red text-white'
                  : 'bg-warm-white/10 text-warm-white/70 hover:bg-warm-white/20 hover:text-warm-white'
              }`}
            >
              {video.campusName}
            </button>
          ))}
        </div>
      )}

      {/* Player area */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
        {/* Thumbnail + play button (visible until player is ready) */}
        {!isReady && (
          <button
            onClick={handleClickPlay}
            disabled={isLoading}
            className="group relative h-full w-full"
          >
            <img
              src={`https://img.youtube.com/vi/${activeVideo.youtubeVideoId}/maxresdefault.jpg`}
              alt="Video thumbnail"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40">
              {isLoading ? (
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rich-red shadow-lg transition-transform group-hover:scale-110">
                  <svg className="ml-1 h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              )}
            </div>
            {!isLoading && (
              <div className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2.5 py-1 text-xs font-medium text-white/90">
                Watch{videos.length > 1 ? ` - ${activeVideo.campusName}` : ''}
                {displayDuration > 0 && ` (${formatTime(displayDuration)})`}
              </div>
            )}
          </button>
        )}

        {/* Heavy player (loaded on demand via next/dynamic) */}
        {isLoading || isReady ? (
          <div className={`absolute inset-0 ${isReady ? '' : 'invisible'}`}>
            <VideoPlayerInner
              video={activeVideo}
              onReady={handleReady}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
