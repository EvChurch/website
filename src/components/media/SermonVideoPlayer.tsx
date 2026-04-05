'use client'

import { useState, useRef } from 'react'

interface VideoSource {
  campusName: string
  youtubeVideoId: string
  startSeconds?: number
  endSeconds?: number
}

interface SermonVideoPlayerProps {
  videos: VideoSource[]
}

/**
 * Sermon video player using YouTube IFrame API.
 * Supports multi-campus video selection and optional segment playback.
 *
 * When startSeconds/endSeconds are provided (Phase 2), the player
 * will seek to the start and pause at the end of the sermon segment.
 */
export function SermonVideoPlayer({ videos }: SermonVideoPlayerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const activeVideo = videos[activeIndex]
  if (!activeVideo) return null

  const embedUrl = buildEmbedUrl(activeVideo)

  return (
    <div className="w-full">
      {/* Campus selector (only show if multiple options) */}
      {videos.length > 1 && (
        <div className="mb-3 flex gap-2">
          {videos.map((video, index) => (
            <button
              key={video.youtubeVideoId}
              onClick={() => {
                setActiveIndex(index)
                setIsPlaying(false)
              }}
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

      {/* Video embed */}
      {!isPlaying ? (
        <button
          onClick={() => setIsPlaying(true)}
          className="group relative aspect-video w-full overflow-hidden rounded-xl bg-black"
        >
          {/* Thumbnail */}
          <img
            src={`https://img.youtube.com/vi/${activeVideo.youtubeVideoId}/maxresdefault.jpg`}
            alt="Sermon video thumbnail"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rich-red shadow-lg transition-transform group-hover:scale-110">
              <svg className="ml-1 h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
          {/* Label */}
          <div className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2.5 py-1 text-xs font-medium text-white/90">
            Watch video{videos.length > 1 ? ` - ${activeVideo.campusName}` : ''}
          </div>
        </button>
      ) : (
        <div className="relative aspect-video w-full overflow-hidden rounded-xl">
          <iframe
            ref={iframeRef}
            src={embedUrl}
            title="Sermon video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      )}
    </div>
  )
}

function buildEmbedUrl(video: VideoSource): string {
  const params = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    modestbranding: '1',
  })

  if (video.startSeconds !== undefined && video.startSeconds > 0) {
    params.set('start', String(Math.round(video.startSeconds)))
  }
  if (video.endSeconds !== undefined && video.endSeconds > 0) {
    params.set('end', String(Math.round(video.endSeconds)))
  }

  return `https://www.youtube-nocookie.com/embed/${video.youtubeVideoId}?${params.toString()}`
}
